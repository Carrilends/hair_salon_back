import { AssistantContext, AssistantTool } from './assistant-tool';
import {
  AssistantPresentation,
  CriterioParcial,
} from './assistant-presentation';
import { CATEGORIAS_SUGERIDAS } from './list-services.tool';
import {
  AssistantServiceSummary,
  ServiceCatalogQueryPort,
} from '../../domain/ports/service-catalog-query.port';
import { analizarBusqueda } from '../../domain/catalog-search';
import {
  MAX_SERVICIOS_WHATSAPP,
  coincidenEnNombre,
  conceptoDe,
  conceptoLegible,
  esElNombreExacto,
  sinPalabrasDeTodo,
  estaAnclado,
  yaPreguntoQueBusca,
  yaPreguntoSobre,
} from '../../domain/catalogo-acotado';
import { coerceOptionalNumber } from './coerce';

const PREGUNTA_CONCEPTO = '¿Qué servicio estás buscando?';
const preguntaOpciones = (concepto: string, opciones: string[]) =>
  `¿Qué opción de ${concepto} te interesa: ${opciones.join(', ')}?`;
const preguntaPrecio = (concepto: string) =>
  `¿Hasta qué precio te gustaría para ${concepto}?`;
const PREGUNTA_TURNO = '¿Por cuál empezamos?';

const MAX_OPCIONES = 6;

interface Servicio {
  id: string;
  nombre: string;
  precio: number;
  minutos: number;
}

const pregunta = (
  motivo: string,
  texto: string,
  opciones?: string[],
  concepto?: string[],
): Record<string, unknown> => ({
  ok: false,
  motivo,
  pregunta: texto,
  ...(opciones && opciones.length > 0 ? { opciones } : {}),
  // Lo lee el bucle para anotar en el historial sobre qué se preguntó (R6).
  ...(concepto ? { concepto } : {}),
});

const aServicio = (s: AssistantServiceSummary): Servicio => ({
  id: s.id,
  nombre: s.name,
  precio: s.price,
  minutos: s.durationMinutes,
});

/**
 * Envuelve `listarServicios` para WhatsApp: el servidor, no el modelo, decide
 * cuándo hay que acotar. Aplica las reglas R1 a R8 en orden; si ninguna
 * entrega, el modelo recibe una pregunta y ningún servicio. No añade
 * argumentos: nada de lo que el modelo escriba puede saltarse las reglas.
 */
export function conCatalogoAcotado(
  listar: AssistantTool,
  catalog: Pick<ServiceCatalogQueryPort, 'search' | 'findNarrowingOptions'>,
): AssistantTool {
  return {
    name: listar.name,
    definition: {
      ...listar.definition,
      description:
        `${listar.definition.description} En WhatsApp puede responder con ` +
        'una pregunta en lugar de servicios: si es así, hazla',
    },
    // Solo aquí se marca un listado como parcial: la web no recibe el campo.
    presentar: async (result: unknown) => {
      const p = (await listar.presentar?.(result)) ?? null;
      const { parcial, criterio } = (result ?? {}) as {
        parcial?: boolean;
        criterio?: CriterioParcial;
      };
      return p?.tipo === 'servicios' && parcial === true && criterio
        ? { ...p, criterio }
        : p;
    },

    async execute(args, context: AssistantContext) {
      // Sin conversación no hay con qué anclar el concepto: falla cerrado.
      const recientes = context.recientes;
      if (!recientes || recientes.length === 0) {
        return pregunta('sin_pedirlo', PREGUNTA_CONCEPTO, CATEGORIAS_SUGERIDAS);
      }

      const busqueda =
        typeof args.busqueda === 'string' ? args.busqueda : undefined;
      const genero = typeof args.genero === 'string' ? args.genero : undefined;
      const precioMaximo = coerceOptionalNumber(args.precioMaximo);
      // Las palabras de «dame todo» no se buscan: el catálogo exige que cada
      // palabra encaje y devolvería vacío.
      const texto = sinPalabrasDeTodo(busqueda);
      const limpios: Record<string, unknown> = {
        ...(texto ? { busqueda: texto } : {}),
        ...(genero !== undefined ? { genero } : {}),
        ...(precioMaximo !== undefined ? { precioMaximo } : {}),
      };

      const turno = (context.serviciosDelTurno ??= new Set<string>());
      // R8 se evalúa sobre lo que se entregaría; solo si pasa se anotan los ids.
      const entregar = (
        lote: Servicio[],
        extra: Record<string, unknown> = {},
      ) => {
        // Proyección explícita: ningún campo extra (URL) llega al modelo.
        lote = lote.map(({ id, nombre, precio, minutos }) => ({
          id,
          nombre,
          precio,
          minutos,
        }));
        const union = new Set([...turno, ...lote.map((s) => s.id)]);
        if (union.size > MAX_SERVICIOS_WHATSAPP) {
          return pregunta('tope_del_turno', PREGUNTA_TURNO);
        }
        union.forEach((id) => turno.add(id));
        return { servicios: lote, ...extra };
      };

      // R1: sin concepto no se consulta. Garantiza `concepto` no vacío abajo
      // (con palabras vacías `coincidenEnNombre` devolvería todo). Pero si ya se
      // le preguntó y sigue sin decirlo, repetir sería un bucle: se le enseña lo
      // de menor precio de cada categoría, y `presentar` lleva la línea que lo dice.
      const concepto = conceptoDe(busqueda);
      if (concepto.length === 0) {
        if (!yaPreguntoQueBusca(recientes)) {
          return pregunta(
            'falta_concepto',
            PREGUNTA_CONCEPTO,
            CATEGORIAS_SUGERIDAS,
          );
        }
        const lote = await menorPrecioPorCategoria(catalog, {
          genero,
          precioMaximo,
        });
        return lote.length > 0
          ? entregar(lote, {
              parcial: true,
              criterio: 'menor_precio_por_categoria',
            })
          : { servicios: [], sugerencias: CATEGORIAS_SUGERIDAS };
      }
      // R2: el concepto tiene que haberlo dicho alguien en la conversación.
      if (!estaAnclado(concepto, recientes)) {
        return pregunta('sin_pedirlo', PREGUNTA_CONCEPTO, CATEGORIAS_SUGERIDAS);
      }

      const original = (await listar.execute(limpios, context)) as {
        servicios?: Servicio[];
        sugerencias?: string[];
      };
      const servicios = original?.servicios ?? [];
      if (servicios.length === 0) return original;

      // Nombre exacto de un servicio («Me interesa» en «Capas en U»): solo ese,
      // aunque «en» y «U» no cuenten como palabras y «capas» dé varios.
      const exacto = servicios.find((s) =>
        esElNombreExacto(s.nombre, busqueda),
      );
      if (exacto) return entregar([exacto]);

      const porPrecio = analizarBusqueda(busqueda).porPrecio;
      // R3: un único nombre que lleva todas las palabras, si caben todas. Con más
      // de 6 no: la ventana solo enseña unas pocas de las coincidencias y dejaría
      // «corte» en un servicio cualquiera. Tampoco con orden por precio: la
      // ventana ya son los más baratos.
      if (
        servicios.length > 1 &&
        servicios.length <= MAX_SERVICIOS_WHATSAPP &&
        !porPrecio
      ) {
        const porNombre = coincidenEnNombre(servicios, concepto);
        if (porNombre.length === 1) return entregar(porNombre);
      }
      // R4
      if (servicios.length <= MAX_SERVICIOS_WHATSAPP) {
        return entregar(servicios);
      }

      const criterios = {
        texto,
        genero,
        precioMaximo,
        ordenarPorPrecio: true,
      };
      const masBaratos = async (): Promise<Servicio[]> =>
        (await catalog.search(criterios, MAX_SERVICIOS_WHATSAPP)).map(
          aServicio,
        );

      // R5: ella fijó el orden.
      if (porPrecio) {
        return entregar(await masBaratos());
      }
      // R6: ya se le preguntó y sigue siendo amplio.
      if (yaPreguntoSobre(concepto, recientes)) {
        return entregar(await masBaratos(), {
          parcial: true,
          criterio: 'menor_precio',
        });
      }
      // R7: preguntar, con subcategorías reales o por precio.
      const opciones = await catalog.findNarrowingOptions(
        { texto, genero, precioMaximo },
        MAX_OPCIONES,
      );
      const nombre = conceptoLegible(busqueda);
      return opciones.length > 0
        ? pregunta(
            'demasiados',
            preguntaOpciones(nombre, opciones),
            opciones,
            concepto,
          )
        : pregunta('demasiados', preguntaPrecio(nombre), undefined, concepto);
    },
  };
}

/**
 * El de menor precio de cada categoría raíz, respetando los filtros que sí dijo.
 * Un servicio de dos categorías no se repite: esa categoría pasa al siguiente.
 */
async function menorPrecioPorCategoria(
  catalog: Pick<ServiceCatalogQueryPort, 'search'>,
  filtros: { genero?: string; precioMaximo?: number },
): Promise<Servicio[]> {
  const lote: Servicio[] = [];
  for (const texto of CATEGORIAS_SUGERIDAS) {
    const filas = await catalog.search(
      { ...filtros, texto, ordenarPorPrecio: true },
      MAX_SERVICIOS_WHATSAPP,
    );
    const siguiente = filas.find((f) => !lote.some((s) => s.id === f.id));
    if (siguiente) lote.push(aServicio(siguiente));
  }
  return lote.slice(0, MAX_SERVICIOS_WHATSAPP);
}

const MAX_POR_FAMILIA = 3;

interface Grupo {
  categoria: string;
  servicios: Servicio[];
}

/**
 * Envuelve `recomendarServicios` para WhatsApp. Una categoría solo se
 * recomienda si ella o su familia salió en la conversación («uñas» ancla
 * «Manicure»); entrega como mucho 6 servicios (2 familias de 3) y respeta el
 * tope del turno (R8). Si hay más, pregunta con las familias. No añade
 * argumentos. Consulta la herramienta original una vez por categoría para
 * saber a qué familia pertenece cada una.
 */
export function conRecomendacionAcotada(
  recomendar: AssistantTool,
): AssistantTool {
  return {
    name: recomendar.name,
    definition: {
      ...recomendar.definition,
      description:
        `${recomendar.definition.description} En WhatsApp puede responder con ` +
        'una pregunta en lugar de servicios: si es así, hazla',
    },
    presentar: (result: unknown) =>
      recomendar.presentar?.(result) as
        | AssistantPresentation
        | null
        | Promise<AssistantPresentation | null>,

    async execute(args, context: AssistantContext) {
      const categorias = Array.isArray(args.categorias)
        ? [
            ...new Set(
              args.categorias.filter((c): c is string => typeof c === 'string'),
            ),
          ]
        : [];
      if (categorias.length === 0) {
        return pregunta(
          'sin_categorias',
          PREGUNTA_CONCEPTO,
          CATEGORIAS_SUGERIDAS,
        );
      }
      const recientes = context.recientes;
      if (!recientes || recientes.length === 0) {
        return pregunta('sin_pedirlo', PREGUNTA_CONCEPTO, CATEGORIAS_SUGERIDAS);
      }

      const familias = new Map<string, Servicio[]>();
      const categoriasDesconocidas: string[] = [];
      for (const categoria of categorias) {
        const r = (await recomendar.execute(
          { ...args, categorias: [categoria] },
          context,
        )) as {
          recomendaciones?: Grupo[];
          categoriasDesconocidas?: string[];
        };
        categoriasDesconocidas.push(...(r?.categoriasDesconocidas ?? []));
        const anclada = estaAnclado(conceptoDe(categoria), recientes);
        for (const g of r?.recomendaciones ?? []) {
          // R2 por categoría o por familia: nadie la mencionó ⇒ no se ofrece.
          if (!anclada && !estaAnclado(conceptoDe(g.categoria), recientes)) {
            continue;
          }
          familias.set(g.categoria, [
            ...(familias.get(g.categoria) ?? []),
            ...g.servicios,
          ]);
        }
      }

      if (
        familias.size === 0 &&
        categoriasDesconocidas.length < categorias.length
      ) {
        return pregunta('sin_pedirlo', PREGUNTA_CONCEPTO, CATEGORIAS_SUGERIDAS);
      }

      const recomendaciones = [...familias].map(([categoria, lista]) => {
        const vistos = new Set<string>();
        const servicios = lista
          .filter((s) => !vistos.has(s.id) && !!vistos.add(s.id))
          .sort((a, b) => a.precio - b.precio)
          .slice(0, MAX_POR_FAMILIA)
          .map(({ id, nombre, precio, minutos }) => ({
            id,
            nombre,
            precio,
            minutos,
          }));
        return { categoria, servicios };
      });

      const ids = recomendaciones.flatMap((g) => g.servicios.map((s) => s.id));
      if (ids.length > MAX_SERVICIOS_WHATSAPP) {
        const nombres = recomendaciones.map((g) => g.categoria);
        return pregunta(
          'demasiados',
          preguntaOpciones('servicios', nombres),
          nombres,
          conceptoDe(nombres.join(' ')),
        );
      }
      const turno = (context.serviciosDelTurno ??= new Set<string>());
      const union = new Set([...turno, ...ids]);
      if (union.size > MAX_SERVICIOS_WHATSAPP) {
        return pregunta('tope_del_turno', PREGUNTA_TURNO);
      }
      union.forEach((id) => turno.add(id));
      return { recomendaciones, categoriasDesconocidas };
    },
  };
}

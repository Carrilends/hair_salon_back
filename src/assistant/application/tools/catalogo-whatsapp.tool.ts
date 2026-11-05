import { AssistantContext, AssistantTool } from './assistant-tool';
import { AssistantPresentation } from './assistant-presentation';
import { CATEGORIAS_SUGERIDAS } from './list-services.tool';
import { ServiceCatalogQueryPort } from '../../domain/ports/service-catalog-query.port';
import { analizarBusqueda } from '../../domain/catalog-search';
import {
  MAX_SERVICIOS_WHATSAPP,
  coincidenEnNombre,
  conceptoDe,
  sinPalabrasDeTodo,
  estaAnclado,
  yaPreguntoSobre,
} from '../../domain/catalogo-acotado';
import { coerceOptionalNumber } from './coerce';

const PREGUNTA_CONCEPTO = '¿Qué servicio estás buscando?';
// Las de R7 nombran el concepto: así `yaPreguntoSobre` (R6) las reconoce.
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
): Record<string, unknown> => ({
  ok: false,
  motivo,
  pregunta: texto,
  ...(opciones && opciones.length > 0 ? { opciones } : {}),
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
    presentar: (result: unknown) =>
      listar.presentar?.(result) as
        | AssistantPresentation
        | null
        | Promise<AssistantPresentation | null>,

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

      // R1: sin concepto no se consulta. Garantiza `concepto` no vacío abajo
      // (con palabras vacías `coincidenEnNombre` devolvería todo).
      const concepto = conceptoDe(busqueda);
      if (concepto.length === 0) {
        return pregunta(
          'falta_concepto',
          PREGUNTA_CONCEPTO,
          CATEGORIAS_SUGERIDAS,
        );
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

      const porPrecio = analizarBusqueda(busqueda).porPrecio;
      // R3: un único nombre que lleva todas las palabras. No con orden por
      // precio: la ventana ya son los más baratos, no todas las coincidencias.
      if (servicios.length > 1 && !porPrecio) {
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
        (await catalog.search(criterios, MAX_SERVICIOS_WHATSAPP)).map((s) => ({
          id: s.id,
          nombre: s.name,
          precio: s.price,
          minutos: s.durationMinutes,
        }));

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
      const nombre = concepto.join(' ');
      return opciones.length > 0
        ? pregunta('demasiados', preguntaOpciones(nombre, opciones), opciones)
        : pregunta('demasiados', preguntaPrecio(nombre));
    },
  };
}

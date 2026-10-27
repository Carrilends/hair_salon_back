import { AssistantTool } from './assistant-tool';
import {
  AssistantPresentation,
  PresentedService,
} from './assistant-presentation';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { AssistantServiceSummary } from '../../domain/ports/service-catalog-query.port';
import { coerceOptionalNumber } from './coerce';

/** Contrato mínimo del catálogo que la recomendación necesita (recuperación por etiquetas). */
export interface RecommendCatalogPort {
  findByTagNames(
    tagNames: string[],
    limitPerTag: number,
  ): Promise<Map<string, AssistantServiceSummary[]>>;

  /**
   * Familia (etiqueta raíz, `parent` nulo) de cada etiqueta pedida: Manicure →
   * «Uñas». Una etiqueta que no existe no aparece en el mapa.
   */
  findTagFamilies(tagNames: string[]): Promise<Map<string, string>>;

  /** Imagen principal por servicio, solo para la tarjeta (nunca para el modelo). */
  findPrincipalImages(ids: string[]): Promise<Map<string, string>>;
}

/** Tope de recomendaciones por familia del catálogo (no por etiqueta). */
const MAX_POR_FAMILIA = 3;
/** Candidatos por etiqueta: de sobra para que el presupuesto filtre antes del tope. */
const CANDIDATOS_POR_ETIQUETA = 10;

/**
 * `recomendarServicios`: aplica P5. Sugiere **servicios del catálogo** a partir de
 * categorías declaradas por la clienta; **no** emite diagnósticos estéticos (qué
 * color o corte favorece), que son criterio de la estilista. Vocabulario cerrado:
 * una categoría que el catálogo no reconoce (sin candidatos) no rompe el turno, se
 * reporta en `categoriasDesconocidas`. No toma identidad: la recomendación es
 * pública, como la consulta del catálogo (sin PII al modelo).
 */
export class RecommendServicesTool implements AssistantTool {
  readonly name = 'recomendarServicios';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Sugiere servicios del catálogo para las categorías de interés de la clienta.',
    parameters: {
      type: 'object',
      properties: {
        categorias: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Categorías de interés, por ejemplo "Manicure", "Mechas y balayage", "Recogidos"',
        },
        presupuestoMaximo: {
          type: 'number',
          description: 'Tope en pesos, opcional',
        },
      },
      required: ['categorias'],
      additionalProperties: false,
    },
  };

  constructor(private readonly catalog: RecommendCatalogPort) {}

  // No toma contexto: la recomendación es pública y no usa identidad. El bucle la
  // invoca igualmente con (args, context); TypeScript admite una firma más corta.
  async execute(args: Record<string, unknown>): Promise<unknown> {
    const categorias = Array.isArray(args.categorias)
      ? [
          ...new Set(
            args.categorias.filter((c): c is string => typeof c === 'string'),
          ),
        ]
      : [];
    if (categorias.length === 0) return { ok: false, motivo: 'sin_categorias' };

    const presupuesto = coerceOptionalNumber(args.presupuestoMaximo);

    const [byTag, familias] = await Promise.all([
      this.catalog.findByTagNames(categorias, CANDIDATOS_POR_ETIQUETA),
      this.catalog.findTagFamilies(categorias),
    ]);

    const categoriasDesconocidas: string[] = [];
    // Familia → candidatos de todas sus subcategorías pedidas (Map conserva el
    // orden de aparición).
    const porFamilia = new Map<string, AssistantServiceSummary[]>();

    for (const categoria of categorias) {
      const candidatos = byTag.get(categoria) ?? [];
      // Vacío del catálogo ⇒ la categoría no existe (o no tiene servicios): se
      // reporta, no se falla. Presupuesto insuficiente es distinto: la familia
      // se conoce y vuelve con lista vacía.
      if (candidatos.length === 0) {
        categoriasDesconocidas.push(categoria);
        continue;
      }
      const familia = familias.get(categoria) ?? categoria;
      porFamilia.set(familia, [
        ...(porFamilia.get(familia) ?? []),
        ...candidatos,
      ]);
    }

    // Orden: presupuesto, sin repetidos, precio ascendente y, al final, el tope.
    const recomendaciones = [...porFamilia].map(([categoria, candidatos]) => {
      const vistos = new Set<string>();
      const servicios = candidatos
        .filter((c) => presupuesto === undefined || c.price <= presupuesto)
        .filter((c) => !vistos.has(c.id) && !!vistos.add(c.id))
        .sort((a, b) => a.price - b.price)
        .slice(0, MAX_POR_FAMILIA)
        .map((c) => ({
          id: c.id,
          nombre: c.name,
          precio: c.price,
          minutos: c.durationMinutes,
        }));
      return { categoria, servicios };
    });

    return { recomendaciones, categoriasDesconocidas };
  }

  /**
   * La misma tarjeta que pinta `listarServicios`, porque recomendar también es
   * enumerar servicios y el prompt manda derivar los listados largos a la
   * tarjeta: sin esto, «recomiéndame algo para uñas y para cejas» se quedaba en
   * «tenemos varias opciones» y ninguna tarjeta donde verlas, que es peor que
   * el listado con asteriscos que este plan vino a arreglar.
   *
   * La tarjeta es una lista plana, así que las categorías se aplanan y el
   * servicio etiquetado en dos de ellas se enseña una sola vez. Como en
   * `listarServicios`, la imagen se consulta aquí y no en `execute`: lo que ve
   * el modelo no lleva ninguna dirección.
   */
  async presentar(result: unknown): Promise<AssistantPresentation | null> {
    const recomendaciones = (
      result as {
        recomendaciones?: { servicios?: PresentedService[] }[];
      }
    )?.recomendaciones;
    if (!Array.isArray(recomendaciones)) return null;

    const porId = new Map<string, PresentedService>();
    for (const grupo of recomendaciones) {
      for (const servicio of grupo.servicios ?? []) {
        if (!porId.has(servicio.id)) porId.set(servicio.id, servicio);
      }
    }
    if (porId.size === 0) return null;

    const imagenes = await this.catalog.findPrincipalImages([...porId.keys()]);
    return {
      tipo: 'servicios',
      servicios: [...porId.values()].map((s) => {
        const imagen = imagenes.get(s.id);
        return imagen ? { ...s, imagen } : { ...s };
      }),
    };
  }
}

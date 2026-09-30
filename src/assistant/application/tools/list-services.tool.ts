import { AssistantTool } from './assistant-tool';
import {
  AssistantPresentation,
  PresentedService,
} from './assistant-presentation';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { ServiceCatalogQueryPort } from '../../domain/ports/service-catalog-query.port';
import { coerceOptionalNumber } from './coerce';

const MAX_RESULTS = 8;

/**
 * Las cuatro etiquetas de género que existen bajo la raíz «Género». Van como
 * enumerado en el esquema para que el modelo no invente variantes («masculino»,
 * «caballero») que el catálogo no reconocería.
 */
const GENEROS = ['Hombre', 'Mujer', 'Unisex', 'Niños'];

/**
 * Categorías raíz reales del catálogo (verificadas contra la BD sembrada), menos
 * «Género», que es una faceta y no algo que se ofrezca. Solo viajan cuando la
 * búsqueda vuelve vacía: sin ellas el modelo cierra el turno con un «no
 * tenemos», que para un catálogo de ciento sesenta servicios casi siempre es
 * falso; con ellas reconduce la conversación.
 */
const CATEGORIAS_SUGERIDAS = [
  'Cabello',
  'Cejas y pestañas',
  'Maquillajes',
  'Tintes',
  'Uñas',
];

/**
 * `listarServicios`: busca en el catálogo, **proyecta** y **acota** (§6.2). La
 * proyección es deliberadamente pobre —ni descripción ni `specifications`—
 * porque el resultado vuelve como contexto de la siguiente llamada y cada campo
 * de más se paga.
 */
export class ListServicesTool implements AssistantTool {
  readonly name = 'listarServicios';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Busca servicios del salón por concepto, género y precio máximo. Devuelve nombre, precio y duración.',
    parameters: {
      type: 'object',
      properties: {
        busqueda: {
          type: 'string',
          description:
            'Solo el concepto buscado, por ejemplo "corte", "manicure" o "peinado"',
        },
        genero: {
          type: 'string',
          enum: GENEROS,
          description: 'Público del servicio, si la clienta lo indica',
        },
        precioMaximo: {
          type: 'number',
          description: 'Tope de precio en pesos, si la clienta lo indica',
        },
      },
      required: [],
      additionalProperties: false,
    },
  };

  constructor(private readonly catalog: ServiceCatalogQueryPort) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const busqueda =
      typeof args.busqueda === 'string' ? args.busqueda : undefined;
    const genero = typeof args.genero === 'string' ? args.genero : undefined;
    const services = await this.catalog.search(
      {
        texto: busqueda,
        genero,
        precioMaximo: coerceOptionalNumber(args.precioMaximo),
      },
      MAX_RESULTS,
    );
    const servicios = services.map((s) => ({
      id: s.id,
      nombre: s.name,
      precio: s.price,
      minutos: s.durationMinutes,
    }));
    // Las sugerencias solo aparecen en el vacío: añadirlas siempre sería pagar
    // contexto en cada llamada acertada (§6.2).
    return servicios.length > 0
      ? { servicios }
      : { servicios, sugerencias: CATEGORIAS_SUGERIDAS };
  }

  /**
   * La tarjeta del chat: los mismos servicios que vio el modelo, más la imagen.
   *
   * La imagen se consulta **aquí** y no en `execute` a propósito. Lo que
   * `execute` devuelve vuelve como contexto de la siguiente llamada y se paga en
   * tokens, así que la proyección que ve el modelo sigue siendo exactamente
   * `{id, nombre, precio, minutos}` (RF56 c.9); la tarjeta, en cambio, va del
   * caso de uso al navegador sin pasar por el LLM, y por eso puede permitirse
   * una URL de Cloudinary. Esa separación es el corazón del plan 03: en cuanto
   * una presentación se le entregue al modelo, deja de ser gratis.
   *
   * Cuesta una consulta más, y solo cuando hubo resultados.
   */
  async presentar(result: unknown): Promise<AssistantPresentation | null> {
    const servicios = (result as { servicios?: PresentedService[] })?.servicios;
    if (!Array.isArray(servicios) || servicios.length === 0) return null;

    const imagenes = await this.catalog.findPrincipalImages(
      servicios.map((s) => s.id),
    );
    return {
      tipo: 'servicios',
      servicios: servicios.map((s) => {
        const imagen = imagenes.get(s.id);
        return imagen ? { ...s, imagen } : { ...s };
      }),
    };
  }
}

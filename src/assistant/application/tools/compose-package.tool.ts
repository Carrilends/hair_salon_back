import { AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import { AssistantServiceSummary } from '../../domain/ports/service-catalog-query.port';
import {
  EVENT_NAMES,
  EVENT_TEMPLATES,
} from '../../domain/packages/event-template';
import {
  compose,
  PackageCandidate,
} from '../../domain/packages/package-composer';

const CANDIDATOS_POR_CATEGORIA = 5;

/** Contrato mínimo del catálogo por etiquetas que la composición necesita. */
export interface ComposePackageCatalogPort {
  findByTagNames(
    tagNames: string[],
    limitPerTag: number,
  ): Promise<Map<string, AssistantServiceSummary[]>>;
}

/**
 * `componerPaquete`: **solo lectura**. Recibe el evento y un presupuesto opcional;
 * consulta candidatos por las etiquetas de la plantilla (T3), llama al compositor
 * puro (T5) y devuelve la propuesta —con las omisiones y su motivo— y la lista
 * explícita `serviciosIds`. **No crea nada**: componer no reserva (P?). El backend
 * compone; el modelo conversa (P2).
 */
export class ComposePackageTool implements AssistantTool {
  readonly name = 'componerPaquete';

  // El widget pinta la propuesta como tarjeta (T7): el bucle la surfacea.
  readonly presentable = true;

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Compone (sin reservar) un paquete de servicios para un evento, según presupuesto.',
    parameters: {
      type: 'object',
      properties: {
        evento: {
          type: 'string',
          description: 'Tipo de evento: boda, quinceanera o grado',
        },
        presupuestoMaximo: {
          type: 'number',
          description: 'Tope en pesos, opcional',
        },
        fecha: {
          type: 'string',
          description:
            'Fecha del evento (ISO), opcional; ayuda a mantener el hilo',
        },
      },
      required: ['evento'],
      additionalProperties: false,
    },
  };

  constructor(private readonly catalog: ComposePackageCatalogPort) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const evento = typeof args.evento === 'string' ? args.evento : '';
    const plantilla = EVENT_TEMPLATES[evento];
    if (!plantilla) {
      return {
        ok: false,
        motivo: 'evento_no_disponible',
        eventosValidos: EVENT_NAMES,
      };
    }

    const presupuesto =
      typeof args.presupuestoMaximo === 'number'
        ? args.presupuestoMaximo
        : undefined;

    const categorias = plantilla.map((s) => s.categoria);
    const byTag = await this.catalog.findByTagNames(
      categorias,
      CANDIDATOS_POR_CATEGORIA,
    );

    // `AssistantServiceSummary` y `PackageCandidate` comparten forma; el compositor
    // solo lee id/name/price/durationMinutes.
    const candidatos = byTag as Map<string, PackageCandidate[]>;
    const propuesta = compose(plantilla, candidatos, presupuesto);

    const fecha = typeof args.fecha === 'string' ? args.fecha : undefined;

    return {
      evento,
      completa: propuesta.completa,
      total: propuesta.total,
      minutos: propuesta.minutos,
      lineas: propuesta.lineas,
      // Lista explícita para `reservarPaquete`: el modelo no puede reservar un
      // paquete que no haya compuesto y enumerado antes.
      serviciosIds: propuesta.lineas.map((l) => l.serviceId),
      omitidas: propuesta.omitidas,
      ...(fecha ? { fecha } : {}),
    };
  }
}

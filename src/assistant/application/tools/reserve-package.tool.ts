import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import {
  CreateReservationExecutor,
  mapDomainErrorToReason,
} from './create-reservation.tool';

/**
 * `reservarPaquete`: **escritura**. Recibe la lista explícita `serviciosIds` (la
 * que devolvió `componerPaquete`) y la fecha, y crea **UNA** reserva con varias
 * líneas de una vez (P4), delegando en el caso de uso real de Reservas (A6): todas
 * las validaciones —sesión, horario, solapamiento— son las de siempre. Exigir
 * `serviciosIds` explícitos es la garantía real de los dos pasos: el modelo no
 * puede reservar un paquete que no haya compuesto y enumerado antes.
 */
export class ReservePackageTool implements AssistantTool {
  readonly name = 'reservarPaquete';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Reserva un paquete ya compuesto: crea UNA reserva con todos sus servicios.',
    parameters: {
      type: 'object',
      properties: {
        serviciosIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'IDs de los servicios del paquete (los de componerPaquete)',
        },
        fechaHoraIso: {
          type: 'string',
          description: 'Fecha y hora de inicio en ISO 8601',
        },
      },
      required: ['serviciosIds', 'fechaHoraIso'],
      additionalProperties: false,
    },
  };

  constructor(private readonly createReservation: CreateReservationExecutor) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (!context.userId) return { ok: false, motivo: 'sesion_requerida' };

    const serviciosIds = Array.isArray(args.serviciosIds)
      ? args.serviciosIds.filter((s): s is string => typeof s === 'string')
      : [];
    const fechaHoraIso =
      typeof args.fechaHoraIso === 'string' ? args.fechaHoraIso : null;
    if (serviciosIds.length === 0 || !fechaHoraIso) {
      return { ok: false, motivo: 'argumentos_invalidos' };
    }

    try {
      // A6: el paquete es UNA reserva con varias líneas. El asistente no es una vía
      // privilegiada; el caso de uso valida horario y solapamiento sobre el total.
      const reservation = await this.createReservation.execute({
        scheduledAt: fechaHoraIso,
        serviceIds: serviciosIds,
        userId: context.userId,
      });
      return {
        ok: true,
        reservaId: reservation.id,
        estado: reservation.status,
      };
    } catch (error) {
      return { ok: false, motivo: mapDomainErrorToReason(error) };
    }
  }
}

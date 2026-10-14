import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import {
  DomainError,
  InvalidStatusTransitionError,
  ReservationNotFoundError,
} from 'src/reservations/domain/errors';
import { esLaDuenaPorWhatsApp } from './view-agenda.tool';

/** Contrato mínimo de `ConfirmReservationUseCase` (A6). */
export interface ConfirmReservationExecutor {
  execute(id: string): Promise<{ status: string }>;
}

/**
 * `confirmarReserva` (plan 06, F3b): **solo la dueña por WhatsApp**. El caso
 * de uso no lleva actor —confirmar es siempre cosa de la peluquería—, así que
 * la única barrera de permisos está aquí y en que la herramienta solo exista
 * en el juego de la dueña. Pasa por el caso de uso real, así que la clienta
 * recibe su aviso «tu cita quedó confirmada» y el panel se entera.
 */
export class ConfirmReservationTool implements AssistantTool {
  readonly name = 'confirmarReserva';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Confirma una cita pendiente. Usa el id que devuelve verAgenda; confírmala solo si la dueña lo pide.',
    parameters: {
      type: 'object',
      properties: {
        reservaId: {
          type: 'string',
          description: 'ID de la reserva a confirmar',
        },
      },
      required: ['reservaId'],
      additionalProperties: false,
    },
  };

  constructor(private readonly confirm: ConfirmReservationExecutor) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (!esLaDuenaPorWhatsApp(context)) {
      return { ok: false, motivo: 'solo_administracion' };
    }
    const id = typeof args.reservaId === 'string' ? args.reservaId : null;
    if (!id) return { ok: false, motivo: 'argumentos_invalidos' };

    try {
      const reservation = await this.confirm.execute(id);
      return { ok: true, estado: reservation.status };
    } catch (error) {
      if (error instanceof ReservationNotFoundError)
        return { ok: false, motivo: 'reserva_no_encontrada' };
      if (error instanceof InvalidStatusTransitionError)
        return { ok: false, motivo: 'estado_no_confirmable' };
      if (error instanceof DomainError)
        return { ok: false, motivo: 'no_disponible' };
      return { ok: false, motivo: 'error_desconocido' };
    }
  }
}

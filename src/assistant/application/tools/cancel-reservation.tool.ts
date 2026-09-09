import { ForbiddenException } from '@nestjs/common';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import {
  CancellationTooLateError,
  DomainError,
  InvalidStatusTransitionError,
  ReservationNotFoundError,
} from 'src/reservations/domain/errors';

/**
 * Contrato mínimo del caso de uso real de cancelación (A6). El actor lleva la
 * identidad y el rol; ambos salen del contexto de sesión, nunca del modelo.
 */
export interface CancelReservationExecutor {
  execute(
    id: string,
    actor: { userId: string | null; isAdmin: boolean },
  ): Promise<{ status: string }>;
}

/**
 * `cancelarReserva`: única herramienta de la Fase 6 que escribe. Recibe **solo**
 * el identificador de la reserva; la identidad y el rol vienen del contexto (P6),
 * jamás de los argumentos. El caso de uso vuelve a comprobar la propiedad y aplica
 * §6.4 (la clienta solo antes de la hora; administración en cualquier momento):
 * dos barreras independientes para el mismo riesgo. Los fallos previsibles vuelven
 * como resultado, no como excepción, para que el modelo los explique.
 */
export class CancelReservationTool implements AssistantTool {
  readonly name = 'cancelarReserva';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    description:
      'Cancela una reserva de la clienta con sesión iniciada, si el ciclo de vida lo permite.',
    parameters: {
      type: 'object',
      properties: {
        reservaId: {
          type: 'string',
          description: 'ID de la reserva a cancelar',
        },
      },
      required: ['reservaId'],
      additionalProperties: false,
    },
  };

  constructor(private readonly cancel: CancelReservationExecutor) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (!context.userId) return { ok: false, motivo: 'sesion_requerida' };

    const id = typeof args.reservaId === 'string' ? args.reservaId : null;
    if (!id) return { ok: false, motivo: 'argumentos_invalidos' };

    try {
      const reservation = await this.cancel.execute(id, {
        userId: context.userId,
        isAdmin: context.isAdmin,
      });
      return { ok: true, estado: reservation.status };
    } catch (error) {
      return { ok: false, motivo: mapCancelErrorToReason(error) };
    }
  }
}

/** Traduce los fallos de la cancelación a motivos cortos y legibles para el modelo. */
export function mapCancelErrorToReason(error: unknown): string {
  // Reserva ajena: el caso de uso lanza ForbiddenException (Nest), no un DomainError.
  if (error instanceof ForbiddenException) return 'no_es_tu_reserva';
  if (error instanceof ReservationNotFoundError) return 'reserva_no_encontrada';
  if (error instanceof CancellationTooLateError) return 'fuera_de_plazo';
  if (error instanceof InvalidStatusTransitionError)
    return 'estado_no_cancelable';
  if (error instanceof DomainError) return 'no_disponible';
  return 'error_desconocido';
}

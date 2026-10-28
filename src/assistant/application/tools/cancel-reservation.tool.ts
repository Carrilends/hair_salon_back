import { ForbiddenException } from '@nestjs/common';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import {
  CancellationTooLateError,
  DomainError,
  InvalidStatusTransitionError,
  ReservationNotFoundError,
  ReservationOwnershipError,
} from 'src/reservations/domain/errors';
import { ReservationActor } from 'src/reservations/domain/reservation-actor';
import { actorDelContexto } from './identidad';
import {
  ARGUMENTOS_DE_LA_CITA,
  citaNoCoincide,
  LectorDeCita,
} from './cita-pedida';

/**
 * Contrato mínimo del caso de uso real de cancelación (A6). El actor lleva la
 * identidad; sale del contexto, nunca del modelo (`actorDelContexto`): `user`
 * o `admin` en la web, y desde el plan 06 `phone` o `admin` en WhatsApp, con el
 * número que firma Meta.
 */
export interface CancelReservationExecutor {
  execute(id: string, actor: ReservationActor): Promise<{ status: string }>;
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
      'Cancela una reserva de la clienta con sesión iniciada, si el ciclo de vida lo permite. ' +
      'Pasa también el día y la hora de la cita tal como la clienta la nombró: si no coinciden con los de esa reserva, no se cancela nada y debes decírselo; nunca canceles otra cita parecida en su lugar. ' +
      'Si la cita que nombra no está en misReservas, consúltala con misReservas pasando ese día.',
    parameters: {
      type: 'object',
      properties: {
        reservaId: {
          type: 'string',
          description: 'ID de la reserva a cancelar',
        },
        ...ARGUMENTOS_DE_LA_CITA,
      },
      required: ['reservaId', 'fechaDeLaCita', 'horaDeLaCita'],
      additionalProperties: false,
    },
  };

  constructor(
    private readonly cancel: CancelReservationExecutor,
    // Siempre se cablea en producción (`buildAssistantTools`); es opcional solo
    // para las pruebas que ejercitan el resto de la herramienta.
    private readonly leer?: LectorDeCita,
  ) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    // En WhatsApp el modelo no escribe (plan 06, D4): allí esta herramienta
    // se sustituye por una que propone y deja la escritura a un botón. Si
    // algún día se cablease por error, se niega igual.
    if (context.canal === 'whatsapp') {
      return { ok: false, motivo: 'requiere_boton' };
    }

    const actor = actorDelContexto(context);
    if (!actor) return { ok: false, motivo: 'sesion_requerida' };

    const id = typeof args.reservaId === 'string' ? args.reservaId : null;
    if (!id) return { ok: false, motivo: 'argumentos_invalidos' };

    if (this.leer) {
      const motivo = await citaNoCoincide(args, id, this.leer);
      if (motivo) return { ok: false, motivo };
    }

    try {
      const reservation = await this.cancel.execute(id, actor);
      return { ok: true, estado: reservation.status };
    } catch (error) {
      return { ok: false, motivo: mapCancelErrorToReason(error) };
    }
  }
}

/** Traduce los fallos de la cancelación a motivos cortos y legibles para el modelo. */
export function mapCancelErrorToReason(error: unknown): string {
  // Reserva ajena. `ForbiddenException` se conserva por compatibilidad: el caso
  // de uso ahora lanza `ReservationOwnershipError`, que sí es un error de dominio.
  if (error instanceof ReservationOwnershipError) return 'no_es_tu_reserva';
  if (error instanceof ForbiddenException) return 'no_es_tu_reserva';
  if (error instanceof ReservationNotFoundError) return 'reserva_no_encontrada';
  if (error instanceof CancellationTooLateError) return 'fuera_de_plazo';
  if (error instanceof InvalidStatusTransitionError)
    return 'estado_no_cancelable';
  if (error instanceof DomainError) return 'no_disponible';
  return 'error_desconocido';
}

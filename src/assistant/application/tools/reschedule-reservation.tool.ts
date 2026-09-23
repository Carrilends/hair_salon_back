import { AssistantContext, AssistantTool } from './assistant-tool';
import { LlmToolDefinition } from '../../domain/ports/llm.port';
import {
  DomainError,
  OutOfBusinessHoursError,
  RescheduleTooLateError,
  ReservationInThePastError,
  ReservationNotFoundError,
  ReservationNotReschedulableError,
  ReservationOwnershipError,
  WorkerOverlapError,
  ChosenWorkerBusyError,
} from 'src/reservations/domain/errors';
import { ReservationActor } from 'src/reservations/domain/reservation-actor';

/**
 * Contrato mínimo del caso de uso real de reprogramación. Como en la
 * cancelación, el actor lo fabrica la herramienta desde el contexto de sesión;
 * el modelo no puede influir en él.
 */
export interface RescheduleReservationExecutor {
  execute(
    id: string,
    scheduledAt: string,
    actor: ReservationActor,
  ): Promise<{ reservation: { status: string }; workerChanged: boolean }>;
}

/**
 * `reprogramarReserva`: mueve una cita de la clienta con sesión iniciada.
 * Fachada delgada sobre `RescheduleReservationUseCase` — ninguna regla de
 * negocio vive aquí; el caso de uso vuelve a comprobar propiedad, plazo,
 * horario y solapes.
 *
 * Se publica sola en MCP: el módulo del asistente exporta el mismo arreglo de
 * objetos que consume la superficie MCP, así que añadirla aquí la hace visible
 * allí sin tocar nada de ese módulo.
 */
export class RescheduleReservationTool implements AssistantTool {
  readonly name = 'reprogramarReserva';

  readonly definition: LlmToolDefinition = {
    name: this.name,
    // Contrato con el modelo: lo que diga aquí es lo que el asistente le promete
    // a la clienta. Prometía «conservando sus servicios y su estilista», y eso
    // dejó de ser cierto para las reservas cuya estilista repartió el sistema:
    // moverlas puede reasignarlas a otra que sí esté libre. Sigue siendo cierto
    // para quien eligió estilista, y el texto tiene que decir de qué depende.
    description:
      'Cambia la fecha y hora de una reserva de la clienta con sesión iniciada, conservando sus servicios. ' +
      'Si la clienta eligió estilista, la conserva; si no eligió ninguna, la cita puede quedar con otra estilista que esté libre a la hora nueva. ' +
      // Consentimiento informado: el aviso previo. Solo tiene sentido cuando
      // puede ocurrir —a quien eligió estilista no se la cambia nunca—, y esa
      // condición la da `misReservas` en `estilistaElegida`. Avisar a quien
      // eligió sería preocuparla por algo que no puede pasarle.
      'Antes de llamarla, si la reserva viene con estilistaElegida en false, avisa a la clienta de que cambiar la hora puede significar que la atienda otra estilista y espera su confirmación. ' +
      // Y el aviso posterior, solo si de verdad cambió. Genérico a propósito: el
      // asistente no nombra estilistas (no tiene esa capacidad ni ese permiso).
      'Si la respuesta trae estilistaCambio en true, dile que le reasignamos estilista; nunca digas nombres de estilistas.',
    parameters: {
      type: 'object',
      properties: {
        reservaId: {
          type: 'string',
          description: 'ID de la reserva que se quiere mover',
        },
        nuevaFecha: {
          type: 'string',
          description:
            'Nueva fecha y hora en formato ISO 8601 (hora de Colombia)',
        },
      },
      required: ['reservaId', 'nuevaFecha'],
      additionalProperties: false,
    },
  };

  constructor(private readonly reschedule: RescheduleReservationExecutor) {}

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    if (!context.userId) return { ok: false, motivo: 'sesion_requerida' };

    const id = typeof args.reservaId === 'string' ? args.reservaId : null;
    const fecha = typeof args.nuevaFecha === 'string' ? args.nuevaFecha : null;
    if (!id || !fecha) return { ok: false, motivo: 'argumentos_invalidos' };

    try {
      const { reservation, workerChanged } = await this.reschedule.execute(
        id,
        fecha,
        context.isAdmin
          ? { kind: 'admin' }
          : { kind: 'user', userId: context.userId },
      );
      // Un sí/no, nunca un nombre: el chat no nombra estilistas. Sin este campo
      // el modelo no tendría cómo enterarse —`misReservas` tampoco proyecta
      // estilista— y la clienta lo sabría el día de la cita.
      return {
        ok: true,
        estado: reservation.status,
        estilistaCambio: workerChanged,
      };
    } catch (error) {
      return { ok: false, motivo: mapRescheduleErrorToReason(error) };
    }
  }
}

/** Traduce los fallos de la reprogramación a motivos cortos para el modelo. */
export function mapRescheduleErrorToReason(error: unknown): string {
  if (error instanceof ReservationOwnershipError) return 'no_es_tu_reserva';
  if (error instanceof ReservationNotFoundError) return 'reserva_no_encontrada';
  if (error instanceof RescheduleTooLateError) return 'fuera_de_plazo';
  if (error instanceof ReservationNotReschedulableError)
    return 'estado_no_movible';
  // ANTES que `WorkerOverlapError`, del que hereda: si el genérico fuera primero
  // se comería al específico y el modelo no podría distinguir «tu estilista no
  // puede a esa hora» (cabe cambiar de hora o reservar sin preferencia) de «el
  // salón está lleno» (solo cabe cambiar de hora).
  if (error instanceof ChosenWorkerBusyError) return 'estilista_ocupada';
  if (error instanceof WorkerOverlapError) return 'hora_ocupada';
  if (error instanceof OutOfBusinessHoursError) return 'fuera_de_horario';
  if (error instanceof ReservationInThePastError) return 'fecha_pasada';
  if (error instanceof DomainError) return 'no_disponible';
  return 'error_desconocido';
}

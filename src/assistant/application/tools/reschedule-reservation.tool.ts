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
import { actorDelContexto } from './identidad';
import { instanteDelSalon } from '../salon-day';
import { AssistantPresentation } from './assistant-presentation';

/** Id de la nueva estilista por objeto-respuesta: no viaja al modelo. */
const nuevaEstilista = new WeakMap<object, string>();

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
  ): Promise<{
    reservation: { status: string; workerId?: string };
    workerChanged: boolean;
  }>;
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
      // Y el aviso posterior: la frase con la nueva estilista la presenta el
      // sistema, aparte, solo si de verdad cambió (TC-RF54-01). El modelo no la
      // repite ni la contradice ni habla de «posible» cambio ya hecho.
      'Si la respuesta trae estilistaCambio en true, el sistema mostrará aparte quién la atenderá: no lo repitas ni nombres estilistas. Si trae false, no menciones otra estilista.',
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
            'Nueva fecha y hora en hora de Colombia, ISO 8601 sin zona (p. ej. 2026-10-23T08:00:00)',
        },
      },
      required: ['reservaId', 'nuevaFecha'],
      additionalProperties: false,
    },
  };

  constructor(
    private readonly reschedule: RescheduleReservationExecutor,
    // Nombre de la estilista por id, solo para la frase presentada. Opcional:
    // sin él la frase dice «otra estilista».
    private readonly nombreDeEstilista?: (id: string) => Promise<string | null>,
  ) {}

  /**
   * TC-RF54-01: si la estilista cambió, la clienta lee una frase fija con su
   * nombre; si no cambió, nada. El nombre no pasa por el resultado del modelo.
   */
  async presentar(result: unknown): Promise<AssistantPresentation | null> {
    if (typeof result !== 'object' || result === null) return null;
    const r = result as { ok?: boolean; estilistaCambio?: boolean };
    if (r.ok !== true || r.estilistaCambio !== true) return null;
    let nombre: string | null = null;
    const id = nuevaEstilista.get(result);
    if (id && this.nombreDeEstilista) {
      try {
        nombre = await this.nombreDeEstilista(id);
      } catch {
        nombre = null;
      }
    }
    return {
      tipo: 'texto',
      lineas: [
        nombre
          ? `Te atenderá ${nombre}, otra estilista.`
          : 'Te atenderá otra estilista.',
      ],
    };
  }

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
    // Sin zona, la hora es la del salón (`instanteDelSalon`), no la del servidor.
    const instante =
      typeof args.nuevaFecha === 'string'
        ? instanteDelSalon(args.nuevaFecha)
        : null;
    const fecha = instante?.toISOString() ?? null;
    if (!id || !fecha) return { ok: false, motivo: 'argumentos_invalidos' };

    try {
      const { reservation, workerChanged } = await this.reschedule.execute(
        id,
        fecha,
        actor,
      );
      // Un sí/no, nunca un nombre: el chat no nombra estilistas. Sin este campo
      // el modelo no tendría cómo enterarse —`misReservas` tampoco proyecta
      // estilista— y la clienta lo sabría el día de la cita.
      const respuesta = {
        ok: true,
        estado: reservation.status,
        estilistaCambio: workerChanged,
      };
      if (workerChanged && reservation.workerId) {
        nuevaEstilista.set(respuesta, reservation.workerId);
      }
      return respuesta;
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

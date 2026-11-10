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
import { conPuntoFinal } from 'src/common/con-punto-final';
import { fechaYHoraEnPalabras, instanteDelSalon } from '../salon-day';
import {
  ARGUMENTOS_DE_LA_CITA,
  comprobarCitaPedida,
  LectorDeCita,
} from './cita-pedida';
import { AssistantPresentation } from './assistant-presentation';

/** Id de la nueva estilista por objeto-respuesta: no viaja al modelo. */
const nuevaEstilista = new WeakMap<object, string>();
/** Inicio nuevo de la cita movida, por objeto-respuesta: no viaja al modelo. */
const nuevoInicio = new WeakMap<object, Date>();

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
    reservation: { status: string; workerId?: string; scheduledAt?: Date };
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
      'Pasa también el día y la hora ACTUALES de esa cita tal como la clienta la nombró (fechaDeLaCita, horaDeLaCita): si no coinciden con la reserva, no se mueve nada y debes decírselo; nunca muevas otra cita parecida. Si la cita que nombra no está en misReservas, consúltala con misReservas pasando ese día. ' +
      'Si la clienta eligió estilista, la conserva; si no eligió ninguna, la cita puede quedar con otra estilista que esté libre a la hora nueva. ' +
      // Consentimiento informado: el aviso previo. Solo tiene sentido cuando
      // puede ocurrir —a quien eligió estilista no se la cambia nunca—, y esa
      // condición la da `misReservas` en `estilistaElegida`. Avisar a quien
      // eligió sería preocuparla por algo que no puede pasarle.
      'Antes de llamarla, si la reserva viene con estilistaElegida en false, avisa a la clienta de que cambiar la hora puede significar que la atienda otra estilista y espera su confirmación. ' +
      // Y el aviso posterior: la frase con la nueva estilista la presenta el
      // sistema, aparte, solo si de verdad cambió (TC-RF54-01). El modelo no la
      // repite ni la contradice ni habla de «posible» cambio ya hecho.
      'Si responde no_coincide_con_lo_pedido o confirmar_con_la_clienta, no vuelvas a llamarla en este turno: pregúntale a la clienta cuál es la cita, repitiendo la hora nueva que pidió. ' +
      'Una vez movida: si la respuesta trae estilistaCambio en true, dile que la atenderá otra estilista (si el canal muestra aparte quién es, no lo repitas ni inventes nombres); si trae false, no menciones otra estilista. Si el canal muestra aparte la confirmación con el día y la hora, no la contradigas.',
    parameters: {
      type: 'object',
      properties: {
        reservaId: {
          type: 'string',
          description:
            'ID de la reserva que se quiere mover, tal como lo devolvió misReservas (no el número de la línea)',
        },
        ...ARGUMENTOS_DE_LA_CITA,
        nuevaFecha: {
          type: 'string',
          description:
            'Nueva fecha y hora en hora de Colombia, ISO 8601 sin zona (p. ej. 2026-10-23T08:00:00)',
        },
      },
      required: ['reservaId', 'nuevaFecha', 'fechaDeLaCita', 'horaDeLaCita'],
      additionalProperties: false,
    },
  };

  constructor(
    private readonly reschedule: RescheduleReservationExecutor,
    // Nombre de la estilista por id, solo para la frase presentada. Opcional:
    // sin él la frase dice «otra estilista».
    private readonly nombreDeEstilista?: (id: string) => Promise<string | null>,
    // Guardia de la cita pedida; siempre cableada en producción.
    private readonly leer?: LectorDeCita,
  ) {}

  /**
   * TC-RF54-01 y revisión final (M-203): todo cambio hecho deja una línea
   * escrita por el sistema con el día y la hora nuevos; si la estilista cambió,
   * la misma línea dice quién la atenderá. El nombre no pasa por el resultado
   * del modelo, ni por el historial (`enElHistorial` lo omite).
   */
  async presentar(result: unknown): Promise<AssistantPresentation | null> {
    if (typeof result !== 'object' || result === null) return null;
    const r = result as { ok?: boolean; estilistaCambio?: boolean };
    if (r.ok !== true) return null;
    const inicio = nuevoInicio.get(result);
    const quedo = inicio
      ? (() => {
          const { fecha, hora } = fechaYHoraEnPalabras(inicio.toISOString());
          return `Tu cita quedó el ${fecha} a las ${hora}`;
        })()
      : 'Tu cita quedó movida';
    if (r.estilistaCambio !== true) {
      return {
        tipo: 'texto',
        lineas: [conPuntoFinal(quedo)],
        clase: 'escritura',
        enElHistorial: conPuntoFinal(quedo),
      };
    }
    let nombre: string | null = null;
    const id = nuevaEstilista.get(result);
    if (id && this.nombreDeEstilista) {
      try {
        nombre = await this.nombreDeEstilista(id);
      } catch {
        nombre = null;
      }
    }
    const sinNombre = `${quedo}; te atenderá otra estilista.`;
    return {
      tipo: 'texto',
      lineas: [
        nombre ? `${quedo}; te atenderá ${nombre}, otra estilista.` : sinNombre,
      ],
      clase: 'escritura',
      enElHistorial: sinNombre,
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

    if (this.leer) {
      const rechazo = await comprobarCitaPedida(
        args,
        id,
        this.leer,
        actor,
        'mover',
        context.citasQueNoCoincidieron,
      );
      if (rechazo) return rechazo;
    }

    try {
      const { reservation, workerChanged } = await this.reschedule.execute(
        id,
        fecha,
        actor,
      );
      // Un sí sin nombre para el modelo; el nombre viaja aparte, presentado. Sin este campo
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
      // La hora que de verdad quedó; si el caso de uso no la devuelve, la
      // pedida, que es exactamente la que el caso de uso fija.
      nuevoInicio.set(respuesta, reservation.scheduledAt ?? instante!);
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

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationScheduling } from '../domain/reservation-scheduling';
import {
  ChosenWorkerBusyError,
  ReservationNotFoundError,
} from '../domain/errors';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { ReservationActor, isAdminActor } from '../domain/reservation-actor';
import { assertCanActOn } from '../domain/reservation-authorization';
import { ReservationNotifierPort } from '../domain/ports/reservation-notifier.port';
import { WorkerAssigner } from './worker-assigner';
import { RESERVATION_REPOSITORY, CLOCK, RESERVATION_NOTIFIER } from './tokens';

/**
 * Mueve una cita en el tiempo. Es la **única** regla de reprogramación del
 * sistema: la usan el portal, el asistente (y con él MCP) y el canal de
 * WhatsApp, para que las tres puertas no puedan divergir.
 *
 * Sigue el mismo orden canónico de validación que la creación (A6): primero lo
 * que no depende del agregado, luego el agregado, luego el mundo.
 *
 * Las líneas nunca cambian —mover una cita no es rehacerla—, pero **la estilista
 * puede cambiar**: solo si la repartió el sistema. Comprobar el solape contra una
 * sola agenda rechazaba citas con el salón medio vacío, porque trataba una
 * asignación interna («Sin preferencia» en el portal, o el chat, que nunca manda
 * estilista) como si fuera una elección de la clienta. Quien sí eligió conserva
 * la suya: es el agregado quien lo impide, no este caso de uso.
 */
/**
 * Lo que sale de reprogramar. Es un objeto y no el agregado a secas porque
 * **«cambió la estilista» no es un estado de la reserva, sino de la operación**:
 * la reserva guardada no sabe con quién estaba antes, y el agregado que devuelve
 * el repositorio se rehidrata desde la base, así que cualquier marca transitoria
 * que se le colgara encima se perdería justo en el camino real.
 *
 * Lo necesitan las puertas que tienen que **contarlo** (el asistente en su
 * respuesta, el portal comparando estilistas); las que no, ignoran el campo.
 */
export interface RescheduleResult {
  reservation: Reservation;
  workerChanged: boolean;
}

@Injectable()
export class RescheduleReservationUseCase {
  private readonly scheduling = new ReservationScheduling();
  private readonly logger = new Logger(RescheduleReservationUseCase.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
    @Inject(RESERVATION_NOTIFIER)
    private readonly notifier: ReservationNotifierPort,
    private readonly assigner: WorkerAssigner,
  ) {}

  async execute(
    id: string,
    scheduledAt: string,
    actor: ReservationActor,
  ): Promise<RescheduleResult> {
    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const minLeadMinutes = Number(
      process.env.RESCHEDULE_MIN_LEAD_MINUTES ?? '0',
    );

    const reservation = await this.repository.findById(id);
    if (!reservation) throw new ReservationNotFoundError(id);

    // La propiedad se comprueba antes de tocar nada: quien no puede actuar sobre
    // la reserva no llega ni a saber si la hora nueva era válida.
    assertCanActOn(reservation, actor);

    const byAdmin = isAdminActor(actor);
    // Se capturan ANTES de mutar: el aviso muestra «antes → después», y sin la
    // estilista de partida no habría forma de saber si cambió.
    const previousScheduledAt = reservation.scheduledAt;
    const previousWorkerId = reservation.workerId;
    reservation.reschedule({
      scheduledAt: new Date(scheduledAt),
      now: this.clock.now(),
      byAdmin,
      minLeadMinutes: Number.isFinite(minLeadMinutes) ? minLeadMinutes : 0,
    });

    // Las dos reglas de agenda reciben el agregado **ya movido**, así que se
    // reutilizan tal cual las escribió la creación.
    this.scheduling.assertWithinBusinessHours(reservation, tz);
    this.scheduling.assertNotInThePast(reservation, this.clock.now());

    // La rama va DESPUÉS del horario y del pasado (orden canónico A6): una
    // petición a las 22:00 debe decir «está cerrado», no «no hay
    // disponibilidad». Es la misma decisión que tomó la creación.
    //
    // En ambas ramas se excluye la propia reserva: su fila ya está persistida y,
    // si no se excluyera, toda reprogramación chocaría con su propia ventana
    // anterior —y, en la rama del reparto, sacaría a su estilista actual de la
    // lista de candidatas—.
    if (reservation.workerPinned) {
      const overlaps = await this.repository.countOverlaps(
        reservation.workerId,
        reservation.scheduledAt,
        reservation.endedAt,
        id,
      );
      // La clienta eligió a esta estilista: si no puede, es un 409, no una
      // sustitución silenciosa. El motivo es suyo y no el del salón lleno,
      // porque los remedios son distintos (cambiar de hora **o** de estilista,
      // frente a solo cambiar de hora).
      if (overlaps > 0) throw new ChosenWorkerBusyError();
    } else {
      // La repartió el sistema, así que se vuelve a repartir con el mismo
      // criterio que la creación. Si ninguna está libre, `elegir` lanza
      // `WorkerOverlapError`: el salón está lleno a esa hora.
      const workerId = await this.assigner.elegir(
        reservation.scheduledAt,
        reservation.endedAt,
        tz,
        { excludeReservationId: id },
      );
      reservation.assignWorker(workerId);
    }

    const saved = await this.repository.save(reservation);

    // Se mide contra lo **guardado**, no contra lo que el reparto dijo que iba a
    // hacer: lo que cuenta el día de la cita es quién quedó en la base. Y solo
    // se avisa si de verdad cambió: el reparto ordena por carga y devolver la
    // misma estilista es lo más probable con la agenda tranquila; repetir «sigue
    // siendo la misma» en cada movimiento sería ruido, y el ruido se ignora.
    const workerChanged = saved.workerId !== previousWorkerId;

    try {
      await this.notifier.reservationRescheduled(saved, {
        byAdmin,
        previousScheduledAt,
        workerChanged,
      });
    } catch (error) {
      // NF11: un canal caído no revierte una cita que ya está persistida.
      this.logger.error(
        `Reserva ${saved.id} reprogramada, pero falló la notificación`,
        error as Error,
      );
    }

    return { reservation: saved, workerChanged };
  }
}

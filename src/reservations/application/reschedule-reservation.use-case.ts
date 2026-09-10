import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationScheduling } from '../domain/reservation-scheduling';
import { WorkerOverlapError, ReservationNotFoundError } from '../domain/errors';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { ReservationActor, isAdminActor } from '../domain/reservation-actor';
import { assertCanActOn } from '../domain/reservation-authorization';
import { RESERVATION_REPOSITORY, CLOCK } from './tokens';

/**
 * Mueve una cita en el tiempo. Es la **única** regla de reprogramación del
 * sistema: la usan el portal, el asistente (y con él MCP) y el canal de
 * WhatsApp, para que las tres puertas no puedan divergir.
 *
 * Sigue el mismo orden canónico de validación que la creación (A6): primero lo
 * que no depende del agregado, luego el agregado, luego el mundo. Ni el
 * estilista ni las líneas cambian: mover una cita no es rehacerla.
 */
@Injectable()
export class RescheduleReservationUseCase {
  private readonly scheduling = new ReservationScheduling();

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
  ) {}

  async execute(
    id: string,
    scheduledAt: string,
    actor: ReservationActor,
  ): Promise<Reservation> {
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

    const overlaps = await this.repository.countOverlaps(
      reservation.workerId,
      reservation.scheduledAt,
      reservation.endedAt,
      // Excluirse a sí misma: la fila ya está persistida y, si no, toda
      // reprogramación chocaría con su propia ventana anterior.
      id,
    );
    if (overlaps > 0) throw new WorkerOverlapError();

    return this.repository.save(reservation);
  }
}

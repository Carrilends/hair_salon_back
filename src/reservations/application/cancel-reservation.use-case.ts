import { Inject, Injectable, Logger } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { ReservationNotFoundError } from '../domain/errors';
import { ReservationActor, isAdminActor } from '../domain/reservation-actor';
import { assertCanActOn } from '../domain/reservation-authorization';
import { ReservationNotifierPort } from '../domain/ports/reservation-notifier.port';
import { RESERVATION_REPOSITORY, CLOCK, RESERVATION_NOTIFIER } from './tokens';

@Injectable()
export class CancelReservationUseCase {
  private readonly logger = new Logger(CancelReservationUseCase.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
    @Inject(RESERVATION_NOTIFIER)
    private readonly notifier: ReservationNotifierPort,
  ) {}

  async execute(id: string, actor: ReservationActor): Promise<Reservation> {
    const reservation = await this.repository.findById(id);
    if (!reservation) throw new ReservationNotFoundError(id);
    assertCanActOn(reservation, actor);
    const byAdmin = isAdminActor(actor);
    reservation.cancel({ byAdmin, now: this.clock.now() });
    const saved = await this.repository.save(reservation);

    // Se avisa DESPUÉS de persistir y sin dejar que el fallo suba: la
    // cancelación ya es un hecho y un canal caído no puede deshacerla (N8).
    try {
      await this.notifier.reservationCancelled(saved, { byAdmin });
    } catch (error) {
      this.logger.error(
        `Reserva ${saved.id} cancelada, pero falló la notificación`,
        error as Error,
      );
    }

    return saved;
  }
}

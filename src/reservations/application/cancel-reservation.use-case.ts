import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { ReservationNotFoundError } from '../domain/errors';
import { ReservationActor, isAdminActor } from '../domain/reservation-actor';
import { assertCanActOn } from '../domain/reservation-authorization';
import { RESERVATION_REPOSITORY, CLOCK } from './tokens';

@Injectable()
export class CancelReservationUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
  ) {}

  async execute(id: string, actor: ReservationActor): Promise<Reservation> {
    const reservation = await this.repository.findById(id);
    if (!reservation) throw new ReservationNotFoundError(id);
    assertCanActOn(reservation, actor);
    reservation.cancel({ byAdmin: isAdminActor(actor), now: this.clock.now() });
    return this.repository.save(reservation);
  }
}

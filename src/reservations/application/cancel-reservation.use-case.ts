import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { ReservationNotFoundError } from '../domain/errors';
import { RESERVATION_REPOSITORY, CLOCK } from './tokens';

export interface CancelActor {
  userId: string | null;
  isAdmin: boolean;
}

@Injectable()
export class CancelReservationUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
  ) {}

  async execute(id: string, actor: CancelActor): Promise<Reservation> {
    const reservation = await this.repository.findById(id);
    if (!reservation) throw new ReservationNotFoundError(id);
    if (!actor.isAdmin && reservation.userId !== actor.userId) {
      throw new ForbiddenException(
        'No puede cancelar una reserva de otro usuario',
      );
    }
    reservation.cancel({ byAdmin: actor.isAdmin, now: this.clock.now() });
    return this.repository.save(reservation);
  }
}

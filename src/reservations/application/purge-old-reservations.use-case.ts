import { Inject, Injectable } from '@nestjs/common';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { RESERVATION_REPOSITORY, CLOCK } from './tokens';
import { ClockPort } from '../domain/ports/clock.port';

@Injectable()
export class PurgeOldReservationsUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  execute() {
    const cutoff = new Date(this.clock.now().getTime());
    cutoff.setMonth(cutoff.getMonth() - 1); // reservas terminadas hace > 1 mes
    return this.repository.deleteEndedBefore(cutoff);
  }
}

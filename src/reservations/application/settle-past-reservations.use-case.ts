import { Inject, Injectable } from '@nestjs/common';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { RESERVATION_REPOSITORY, CLOCK } from './tokens';

@Injectable()
export class SettlePastReservationsUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
  ) {}

  execute(): Promise<number> {
    return this.repository.settlePastReservations(this.clock.now());
  }
}

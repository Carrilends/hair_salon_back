import { Inject, Injectable } from '@nestjs/common';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { RESERVATION_REPOSITORY, CLOCK } from './tokens';
import { ClockPort } from '../domain/ports/clock.port';

@Injectable()
export class ListActiveReservationsUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  execute() {
    return this.repository.findActiveWithWorker(this.clock.now());
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { RESERVATION_REPOSITORY } from './tokens';

@Injectable()
export class GetMyReservationsUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
  ) {}

  execute(userId: string) {
    return this.repository.findByUser(userId);
  }
}

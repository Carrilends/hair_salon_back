import { Inject, Injectable } from '@nestjs/common';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ReservationNotFoundError } from '../domain/errors';
import { RESERVATION_REPOSITORY } from './tokens';

@Injectable()
export class CancelReservationUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
  ) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.repository.deleteById(id);
    if (!deleted) throw new ReservationNotFoundError(id);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ReservationNotFoundError } from '../domain/errors';
import { RESERVATION_REPOSITORY } from './tokens';

@Injectable()
export class ConfirmReservationUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
  ) {}

  async execute(id: string): Promise<Reservation> {
    const reservation = await this.repository.findById(id);
    if (!reservation) throw new ReservationNotFoundError(id);
    reservation.confirm();
    return this.repository.save(reservation);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { RESERVATION_REPOSITORY } from './tokens';

/**
 * Lee una reserva por id. **No autoriza nada**: quien la pida debe comprobar
 * aparte si puede verla. La usa el canal de WhatsApp para poder hablar de una
 * cita (su hora, su estilista, su duración) antes de intentar actuar sobre ella.
 */
@Injectable()
export class GetReservationUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
  ) {}

  execute(id: string): Promise<Reservation | null> {
    return this.repository.findById(id);
  }
}

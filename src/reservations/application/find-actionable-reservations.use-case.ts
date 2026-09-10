import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { RESERVATION_REPOSITORY, CLOCK } from './tokens';

/**
 * Citas sobre las que un número de teléfono puede actuar. Existe para que el
 * canal de WhatsApp no tenga que hablar con la persistencia: como el asistente,
 * consume casos de uso y nada más.
 */
@Injectable()
export class FindActionableReservationsUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
  ) {}

  execute(phoneE164: string): Promise<Reservation[]> {
    return this.repository.findActiveByPhone(phoneE164, this.clock.now());
  }
}

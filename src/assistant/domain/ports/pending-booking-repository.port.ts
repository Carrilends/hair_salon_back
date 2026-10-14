import {
  ConsumeResult,
  PendingBooking,
  PendingBookingOutcome,
} from '../pending-booking';

/**
 * Persistencia de las propuestas de reserva (plan 06, D4).
 *
 * `consume` es **atómico**: de dos pulsaciones simultáneas del mismo botón,
 * solo una lo consigue. Es lo que impide que un doble toque cree dos citas.
 */
export interface PendingBookingRepositoryPort {
  save(booking: Omit<PendingBooking, 'id'>): Promise<PendingBooking>;

  consume(
    id: string,
    phoneE164: string,
    now: Date,
    outcome: PendingBookingOutcome,
  ): Promise<ConsumeResult>;

  /** Borra las vencidas antes de `before`. Devuelve cuántas. */
  purgeExpiredBefore(before: Date): Promise<number>;
}

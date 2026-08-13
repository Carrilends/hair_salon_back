import { ConfirmReservationUseCase } from './confirm-reservation.use-case';
import { Reservation } from '../domain/reservation';
import { ReservationNotFoundError } from '../domain/errors';

const lines = [
  { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
];

function pending(): Reservation {
  return Reservation.schedule({
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    workerId: 'w-1',
    userId: 'u-1',
    lines,
  });
}

describe('ConfirmReservationUseCase', () => {
  it('confirma una reserva pendiente existente y la persiste', async () => {
    const r = pending();
    let saved: Reservation | undefined;
    const repo = {
      findById: async () => r,
      save: async (x: Reservation) => {
        saved = x;
        return x;
      },
    };
    const uc = new ConfirmReservationUseCase(repo as any);

    const result = await uc.execute('r-1');
    expect(result.status).toBe('confirmada');
    expect(saved).toBe(r);
  });

  it('lanza ReservationNotFoundError cuando no existe', async () => {
    const repo = { findById: async () => null, save: async () => undefined };
    const uc = new ConfirmReservationUseCase(repo as any);

    await expect(uc.execute('missing')).rejects.toThrow(
      ReservationNotFoundError,
    );
  });
});

import { CancelReservationUseCase } from './cancel-reservation.use-case';
import { Reservation } from '../domain/reservation';
import {
  CancellationTooLateError,
  ReservationNotFoundError,
} from '../domain/errors';

const lines = [
  { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
];

function make(userId: string): Reservation {
  return Reservation.schedule({
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    workerId: 'w-1',
    userId,
    lines,
  });
}

function repoWith(r: Reservation | null) {
  return {
    findById: async () => r,
    save: async (x: Reservation) => x,
  } as any;
}

describe('CancelReservationUseCase', () => {
  it('el dueño cancela antes de la hora', async () => {
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(repoWith(make('u-1')), clock as any);
    const result = await uc.execute('r-1', { userId: 'u-1', isAdmin: false });
    expect(result.status).toBe('cancelada');
  });

  it('el dueño NO puede cancelar pasada la hora', async () => {
    const clock = { now: () => new Date('2026-04-20T16:00:00.000Z') };
    const uc = new CancelReservationUseCase(repoWith(make('u-1')), clock as any);
    await expect(
      uc.execute('r-1', { userId: 'u-1', isAdmin: false }),
    ).rejects.toThrow(CancellationTooLateError);
  });

  it('administración cancela aunque haya pasado la hora', async () => {
    const clock = { now: () => new Date('2026-04-20T16:00:00.000Z') };
    const uc = new CancelReservationUseCase(repoWith(make('u-1')), clock as any);
    const result = await uc.execute('r-1', { userId: null, isAdmin: true });
    expect(result.status).toBe('cancelada');
  });

  it('un usuario no puede cancelar la reserva de otro', async () => {
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(repoWith(make('u-1')), clock as any);
    await expect(
      uc.execute('r-1', { userId: 'otro', isAdmin: false }),
    ).rejects.toThrow();
  });

  it('lanza ReservationNotFoundError cuando no existe', async () => {
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(repoWith(null), clock as any);
    await expect(
      uc.execute('missing', { userId: 'u-1', isAdmin: false }),
    ).rejects.toThrow(ReservationNotFoundError);
  });
});

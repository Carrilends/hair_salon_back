import { ConfirmReservationUseCase } from './confirm-reservation.use-case';
import { Reservation } from '../domain/reservation';
import { ReservationNotFoundError } from '../domain/errors';

const lines = [
  { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
];

const noopNotifier = {
  reservationCreated: async () => undefined,
  reservationCancelled: async () => undefined,
  reservationRescheduled: async () => undefined,
  reservationConfirmed: async () => undefined,
} as any;

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
    const uc = new ConfirmReservationUseCase(repo as any, noopNotifier);

    const result = await uc.execute('r-1');
    expect(result.status).toBe('confirmada');
    expect(saved).toBe(r);
  });

  it('lanza ReservationNotFoundError cuando no existe', async () => {
    const repo = { findById: async () => null, save: async () => undefined };
    const uc = new ConfirmReservationUseCase(repo as any, noopNotifier);

    await expect(uc.execute('missing')).rejects.toThrow(
      ReservationNotFoundError,
    );
  });

  it('avisa DESPUÉS de persistir', async () => {
    // Hasta aquí confirmar era mudo: ni la clienta recibía «tu cita quedó
    // confirmada» ni el panel de otra pestaña se enteraba. Es el aviso que la
    // clienta más espera.
    const r = pending();
    const orden: string[] = [];
    const repo = {
      findById: async () => r,
      save: async (x: Reservation) => {
        orden.push('save');
        return x;
      },
    };
    const espia = {
      reservationConfirmed: async () => {
        orden.push('notify');
      },
    } as any;
    const uc = new ConfirmReservationUseCase(repo as any, espia);

    await uc.execute('r-1');

    expect(orden).toEqual(['save', 'notify']);
  });

  it('un fallo del aviso NO deshace la confirmación', async () => {
    const r = pending();
    const repo = { findById: async () => r, save: async (x: Reservation) => x };
    const roto = {
      reservationConfirmed: async () => {
        throw new Error('sin red');
      },
    } as any;
    const uc = new ConfirmReservationUseCase(repo as any, roto);

    const result = await uc.execute('r-1');

    expect(result.status).toBe('confirmada');
  });
});

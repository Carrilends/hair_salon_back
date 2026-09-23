import { CancelReservationUseCase } from './cancel-reservation.use-case';
import { Reservation } from '../domain/reservation';
import {
  CancellationTooLateError,
  ReservationNotFoundError,
  ReservationOwnershipError,
} from '../domain/errors';

const lines = [
  { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
];

function make(userId: string): Reservation {
  return Reservation.schedule({
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    workerId: 'w-1',
    workerPinned: false,
    userId,
    lines,
  });
}

const noopNotifier = {
  reservationCreated: async () => undefined,
  reservationCancelled: async () => undefined,
  reservationRescheduled: async () => undefined,
} as any;

function repoWith(r: Reservation | null) {
  return {
    findById: async () => r,
    save: async (x: Reservation) => x,
  } as any;
}

describe('CancelReservationUseCase', () => {
  it('el dueño cancela antes de la hora', async () => {
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(
      repoWith(make('u-1')),
      clock as any,
      noopNotifier,
    );
    const result = await uc.execute('r-1', { kind: 'user', userId: 'u-1' });
    expect(result.status).toBe('cancelada');
  });

  it('el dueño NO puede cancelar pasada la hora', async () => {
    const clock = { now: () => new Date('2026-04-20T16:00:00.000Z') };
    const uc = new CancelReservationUseCase(
      repoWith(make('u-1')),
      clock as any,
      noopNotifier,
    );
    await expect(
      uc.execute('r-1', { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(CancellationTooLateError);
  });

  it('administración cancela aunque haya pasado la hora', async () => {
    const clock = { now: () => new Date('2026-04-20T16:00:00.000Z') };
    const uc = new CancelReservationUseCase(
      repoWith(make('u-1')),
      clock as any,
      noopNotifier,
    );
    const result = await uc.execute('r-1', { kind: 'admin' });
    expect(result.status).toBe('cancelada');
  });

  it('un usuario no puede cancelar la reserva de otro', async () => {
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(
      repoWith(make('u-1')),
      clock as any,
      noopNotifier,
    );
    await expect(
      uc.execute('r-1', { kind: 'user', userId: 'otro' }),
    ).rejects.toThrow(ReservationOwnershipError);
  });

  it('lanza ReservationNotFoundError cuando no existe', async () => {
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(
      repoWith(null),
      clock as any,
      noopNotifier,
    );
    await expect(
      uc.execute('missing', { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(ReservationNotFoundError);
  });

  it('un número de teléfono cancela la reserva anónima que hizo', async () => {
    // El canal de WhatsApp no tiene sesión: la identidad es el `wa_id` que Meta
    // verifica. La propiedad se comprueba contra el teléfono de la reserva.
    const anonima = Reservation.schedule({
      scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
      workerId: 'w-1',
      workerPinned: false,
      contact: { name: 'Ana', phone: '+57 300 123 4567' },
      lines,
    });
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(
      repoWith(anonima),
      clock as any,
      noopNotifier,
    );

    const result = await uc.execute('r-1', {
      kind: 'phone',
      phoneE164: '573001234567',
    });

    expect(result.status).toBe('cancelada');
  });

  it('un número ajeno NO puede cancelar una reserva anónima', async () => {
    const anonima = Reservation.schedule({
      scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
      workerId: 'w-1',
      workerPinned: false,
      contact: { name: 'Ana', phone: '3001234567' },
      lines,
    });
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(
      repoWith(anonima),
      clock as any,
      noopNotifier,
    );

    await expect(
      uc.execute('r-1', { kind: 'phone', phoneE164: '573009999999' }),
    ).rejects.toThrow(ReservationOwnershipError);
  });

  it('avisa después de persistir, diciendo si canceló la administración', async () => {
    const avisos: { byAdmin: boolean }[] = [];
    const espia = {
      reservationCancelled: async (
        _r: Reservation,
        meta: { byAdmin: boolean },
      ) => {
        avisos.push(meta);
      },
    } as any;
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(
      repoWith(make('u-1')),
      clock as any,
      espia,
    );

    await uc.execute('r-1', { kind: 'admin' });

    expect(avisos).toEqual([{ byAdmin: true }]);
  });

  it('un fallo del aviso NO deshace la cancelación', async () => {
    const roto = {
      reservationCancelled: async () => {
        throw new Error('sin red');
      },
    } as any;
    const clock = { now: () => new Date('2026-04-20T14:00:00.000Z') };
    const uc = new CancelReservationUseCase(
      repoWith(make('u-1')),
      clock as any,
      roto,
    );

    const result = await uc.execute('r-1', { kind: 'user', userId: 'u-1' });

    expect(result.status).toBe('cancelada');
  });
});

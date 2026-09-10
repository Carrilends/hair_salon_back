import { RescheduleReservationUseCase } from './reschedule-reservation.use-case';
import { Reservation } from '../domain/reservation';
import { ReservationStatus } from '../domain/reservation-status';
import {
  OutOfBusinessHoursError,
  RescheduleTooLateError,
  ReservationInThePastError,
  ReservationNotFoundError,
  ReservationOwnershipError,
  WorkerOverlapError,
} from '../domain/errors';

const lines = [
  { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 60 },
];

// 2026-04-20 es lunes. 14:00Z = 09:00 en Bogotá (dentro del horario L–V 08–20).
const AHORA = new Date('2026-04-20T12:00:00.000Z');
const ORIGINAL = new Date('2026-04-20T15:00:00.000Z'); // 10:00 Bogotá
const NUEVA = new Date('2026-04-21T16:00:00.000Z'); // martes 11:00 Bogotá

function reserva(overrides: Partial<{ status: ReservationStatus }> = {}) {
  return Reservation.fromPersistence({
    id: 'r-1',
    userId: 'u-1',
    contact: null,
    scheduledAt: ORIGINAL,
    endedAt: new Date('2026-04-20T16:00:00.000Z'),
    workerId: 'w-1',
    status: overrides.status ?? ReservationStatus.Pendiente,
    lines,
  });
}

function repo(
  r: Reservation | null,
  opts: { overlaps?: number } = {},
): {
  port: any;
  guardados: Reservation[];
  overlapArgs: unknown[][];
} {
  const guardados: Reservation[] = [];
  const overlapArgs: unknown[][] = [];
  const port = {
    findById: async () => r,
    countOverlaps: async (...args: unknown[]) => {
      overlapArgs.push(args);
      return opts.overlaps ?? 0;
    },
    save: async (x: Reservation) => {
      guardados.push(x);
      return x;
    },
  };
  return { port, guardados, overlapArgs };
}

const clock = { now: () => AHORA } as any;
const noopNotifier = {
  reservationCreated: async () => undefined,
  reservationCancelled: async () => undefined,
  reservationRescheduled: async () => undefined,
} as any;

beforeEach(() => {
  process.env.SALON_TZ = 'America/Bogota';
  delete process.env.RESCHEDULE_MIN_LEAD_MINUTES;
});

describe('RescheduleReservationUseCase · orden canónico de validación', () => {
  it('mueve la reserva y la persiste', async () => {
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    const result = await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(result.scheduledAt).toEqual(NUEVA);
    expect(guardados).toHaveLength(1);
  });

  it('lanza ReservationNotFoundError si no existe', async () => {
    const { port } = repo(null);
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(ReservationNotFoundError);
  });

  it('comprueba la propiedad ANTES de tocar el agregado', async () => {
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'otra' }),
    ).rejects.toThrow(ReservationOwnershipError);
    expect(guardados).toHaveLength(0);
  });

  it('respeta el plazo del agregado', async () => {
    const { port } = repo(reserva());
    const tarde = { now: () => new Date('2026-04-20T16:00:00.000Z') } as any;
    const uc = new RescheduleReservationUseCase(port, tarde, noopNotifier);

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(RescheduleTooLateError);
  });

  it('rechaza una hora fuera del horario del salón', async () => {
    // 2026-04-21T03:00Z = 22:00 del lunes en Bogotá, después del cierre.
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    await expect(
      uc.execute('r-1', '2026-04-21T03:00:00.000Z', {
        kind: 'user',
        userId: 'u-1',
      }),
    ).rejects.toThrow(OutOfBusinessHoursError);
    expect(guardados).toHaveLength(0);
  });

  it('rechaza mover la cita al pasado', async () => {
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    await expect(
      uc.execute('r-1', '2026-04-19T15:00:00.000Z', {
        kind: 'user',
        userId: 'u-1',
      }),
    ).rejects.toThrow(ReservationInThePastError);
    expect(guardados).toHaveLength(0);
  });

  it('excluye la propia reserva al contar solapes', async () => {
    // Sin esto, la fila ya persistida se contaría a sí misma y ninguna
    // reprogramación sería posible.
    const { port, overlapArgs } = repo(reserva());
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(overlapArgs[0][3]).toBe('r-1');
  });

  it('lanza WorkerOverlapError si el estilista ya está ocupado', async () => {
    const { port, guardados } = repo(reserva(), { overlaps: 1 });
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(WorkerOverlapError);
    expect(guardados).toHaveLength(0);
  });

  it('un agregado que falla una validación posterior NUNCA se persiste', async () => {
    // El mutador ya corrió cuando se valida el horario: si algo falla después,
    // lo único que importa es que no llegue al repositorio.
    const { port, guardados } = repo(reserva(), { overlaps: 3 });
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow();
    expect(guardados).toHaveLength(0);
  });
});

describe('RescheduleReservationUseCase · margen de antelación', () => {
  it('aplica RESCHEDULE_MIN_LEAD_MINUTES a quien no es administración', async () => {
    process.env.RESCHEDULE_MIN_LEAD_MINUTES = '240'; // 4 h; la cita es en 3 h
    const { port } = repo(reserva());
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(RescheduleTooLateError);
  });

  it('no se lo aplica a administración', async () => {
    process.env.RESCHEDULE_MIN_LEAD_MINUTES = '240';
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(port, clock, noopNotifier);

    await uc.execute('r-1', NUEVA.toISOString(), { kind: 'admin' });

    expect(guardados).toHaveLength(1);
  });
});

describe('RescheduleReservationUseCase · aviso', () => {
  it('avisa después de persistir, con la hora ANTERIOR y quién movió', async () => {
    const avisos: any[] = [];
    const { port } = repo(reserva());
    const espia = {
      reservationRescheduled: async (r: Reservation, meta: unknown) => {
        avisos.push({ id: r.id, meta });
      },
    } as any;
    const uc = new RescheduleReservationUseCase(port, clock, espia);

    await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(avisos).toHaveLength(1);
    expect(avisos[0].meta).toEqual({
      previousScheduledAt: ORIGINAL,
      byAdmin: false,
    });
  });

  it('un fallo del aviso NO deshace la reprogramación', async () => {
    const { port, guardados } = repo(reserva());
    const roto = {
      reservationRescheduled: async () => {
        throw new Error('sin red');
      },
    } as any;
    const uc = new RescheduleReservationUseCase(port, clock, roto);

    const result = await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(result.scheduledAt).toEqual(NUEVA);
    expect(guardados).toHaveLength(1);
  });
});

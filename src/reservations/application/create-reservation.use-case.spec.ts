import { CreateReservationUseCase } from './create-reservation.use-case';
import {
  OutOfBusinessHoursError,
  WorkerOverlapError,
  MissingContactError,
  InvalidReservationError,
} from '../domain/errors';
import { Reservation } from '../domain/reservation';

const catalog = {
  getSnapshots: async (ids: string[]) =>
    ids.map((id) => ({
      id,
      name: 'Corte',
      price: 20000,
      durationMinutes: 30,
    })),
};

const workers = {
  countParallelStylists: async () => 3,
  getDefaultWorkerId: async () => 'default-w',
};

function repo() {
  return {
    overlaps: 0,
    countOverlaps: async function () {
      return this.overlaps;
    },
    save: async (r: Reservation) =>
      Reservation.fromPersistence({
        id: 'r-1',
        userId: r.userId,
        contact: r.contact,
        scheduledAt: r.scheduledAt,
        endedAt: r.endedAt,
        workerId: r.workerId,
        status: r.status,
        lines: r.lines,
      }),
  } as any;
}

describe('CreateReservationUseCase (maduro)', () => {
  beforeEach(() => {
    process.env.SALON_TZ = 'America/Bogota';
  });

  it('crea con 2 servicios y deriva 60 min de duración', async () => {
    const uc = new CreateReservationUseCase(
      repo(),
      workers as any,
      catalog as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1', 's2'],
      userId: 'u-1',
    });
    expect(result.totalDurationMinutes).toBe(60);
    expect(result.id).toBe('r-1');
  });

  it('usa el estilista por defecto cuando no se envía workerId', async () => {
    const uc = new CreateReservationUseCase(
      repo(),
      workers as any,
      catalog as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1'],
      userId: 'u-1',
    });
    expect(result.workerId).toBe('default-w');
  });

  it('exige contacto si la reserva es anónima', async () => {
    const uc = new CreateReservationUseCase(
      repo(),
      workers as any,
      catalog as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1'],
      }),
    ).rejects.toThrow(MissingContactError);
  });

  it('rechaza cuando algún servicio no existe en el catálogo', async () => {
    const emptyCatalog = { getSnapshots: async () => [] };
    const uc = new CreateReservationUseCase(
      repo(),
      workers as any,
      emptyCatalog as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(InvalidReservationError);
  });

  it('rechaza fuera de horario', async () => {
    const uc = new CreateReservationUseCase(
      repo(),
      workers as any,
      catalog as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-21T03:00:00.000Z', // 22:00 Bogotá
        serviceIds: ['s1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(OutOfBusinessHoursError);
  });

  it('rechaza por solapamiento', async () => {
    const r = repo();
    r.overlaps = 1;
    const uc = new CreateReservationUseCase(r, workers as any, catalog as any);
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(WorkerOverlapError);
  });
});

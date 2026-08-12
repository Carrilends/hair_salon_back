import { CreateReservationUseCase } from './create-reservation.use-case';
import { OutOfBusinessHoursError, WorkerOverlapError } from '../domain/errors';
import { Reservation } from '../domain/reservation';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { WorkerAvailabilityPort } from '../domain/ports/worker-availability.port';

class FakeRepo implements Partial<ReservationRepositoryPort> {
  overlaps = 0;
  saved: Reservation[] = [];
  countOverlaps = async () => this.overlaps;
  save = async (r: Reservation) => {
    const withId = Reservation.fromPersistence({
      id: 'r-1',
      scheduledAt: r.scheduledAt,
      endedAt: r.endedAt,
      workerId: r.workerId,
      totalDurationMinutes: r.totalDurationMinutes,
    });
    this.saved.push(withId);
    return withId;
  };
}

const workers: WorkerAvailabilityPort = {
  countParallelStylists: async () => 3,
  getDefaultWorkerId: async () => 'default-w',
};

describe('CreateReservationUseCase', () => {
  beforeEach(() => {
    process.env.SALON_TZ = 'America/Bogota';
  });

  it('crea la reserva cuando está en horario y sin solape', async () => {
    const repo = new FakeRepo();
    const uc = new CreateReservationUseCase(repo as any, workers);
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z', // 10:00 Bogotá
      totalDurationMinutes: 60,
      workerId: 'w-1',
    });
    expect(result.id).toBe('r-1');
    expect(repo.saved).toHaveLength(1);
  });

  it('usa el estilista por defecto cuando no se envía workerId', async () => {
    const repo = new FakeRepo();
    const uc = new CreateReservationUseCase(repo as any, workers);
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      totalDurationMinutes: 60,
    });
    expect(result.workerId).toBe('default-w');
  });

  it('rechaza fuera de horario', async () => {
    const repo = new FakeRepo();
    const uc = new CreateReservationUseCase(repo as any, workers);
    await expect(
      uc.execute({
        scheduledAt: '2026-04-21T03:00:00.000Z', // 22:00 Bogotá
        totalDurationMinutes: 30,
        workerId: 'w-1',
      }),
    ).rejects.toThrow(OutOfBusinessHoursError);
  });

  it('rechaza por solapamiento', async () => {
    const repo = new FakeRepo();
    repo.overlaps = 1;
    const uc = new CreateReservationUseCase(repo as any, workers);
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        totalDurationMinutes: 60,
        workerId: 'w-1',
      }),
    ).rejects.toThrow(WorkerOverlapError);
  });
});

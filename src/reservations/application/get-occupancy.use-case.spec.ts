import { BadRequestException } from '@nestjs/common';
import { GetOccupancyUseCase } from './get-occupancy.use-case';
import {
  OccupancyMinuteRow,
  ReservationRepositoryPort,
} from '../domain/ports/reservation-repository.port';
import { WorkerAbsenceRepositoryPort } from '../domain/ports/worker-absence-repository.port';
import { WorkerAvailabilityPort } from '../domain/ports/worker-availability.port';

// Rango fijo en el pasado (2026-04-20, lunes) para que el ajuste "hoy" no
// aplique: capacidad = estilistas × minutos laborables del día (08:00–20:00 →
// 720 min) y los minutos usados son la duración completa de cada reserva.
class FakeRepo implements Partial<ReservationRepositoryPort> {
  constructor(private readonly rows: OccupancyMinuteRow[]) {}
  findOccupancyRows = async () => this.rows;
}

const sinAusencias = {
  minutesByWorkerAndDate: async () => [],
} as unknown as WorkerAbsenceRepositoryPort;

const workers: WorkerAvailabilityPort = {
  countParallelStylists: async () => 3,
  getDefaultWorkerId: async () => 'default-w',
  // La ocupación agregada no elige estilista; el puerto lo exige, el caso de uso
  // no lo usa.
  listAssignableWorkloads: async () => [],
  findWorker: async () => null,
};

describe('GetOccupancyUseCase', () => {
  beforeEach(() => {
    process.env.SALON_TZ = 'America/Bogota';
  });

  it('agrega minutos usados por día y calcula capacidad = estilistas × minutos laborables', async () => {
    const repo = new FakeRepo([
      { dateKey: '2026/04/20', startMin: 600, durationMin: 60 },
      { dateKey: '2026/04/20', startMin: 720, durationMin: 30 },
    ]);
    const uc = new GetOccupancyUseCase(repo as any, workers, sinAusencias);

    const result = await uc.execute('2026-04-20', '2026-04-20');

    expect(result.parallelStylists).toBe(3);
    expect(result.salonTimeZone).toBe('America/Bogota');
    expect(result.byDate['2026/04/20']).toEqual({
      usedMinutes: 90, // 60 + 30
      capacityMinutes: 2160, // 3 × 720 (L–V 08:00–20:00 = 12 h)
    });
  });

  it('ocupación: el día suma los minutos ausentes y no supera la capacidad', async () => {
    const repo = new FakeRepo([
      { dateKey: '2026/04/20', startMin: 600, durationMin: 60 },
    ]);
    const ausencias = {
      minutesByWorkerAndDate: async () => [
        { workerId: 'w-1', dateYmd: '2026-04-20', minutes: 240 },
        { workerId: 'w-2', dateYmd: '2026-04-20', minutes: 100 },
        // Una ausencia de varios días acumulada en su día de inicio: el
        // tope de la capacidad evita pasarse.
        { workerId: 'w-3', dateYmd: '2026-04-21', minutes: 99999 },
      ],
    } as unknown as WorkerAbsenceRepositoryPort;
    const uc = new GetOccupancyUseCase(repo as any, workers, ausencias);

    const result = await uc.execute('2026-04-20', '2026-04-21');

    expect(result.byDate['2026/04/20'].usedMinutes).toBe(60 + 240 + 100);
    expect(result.byDate['2026/04/21']).toEqual({
      usedMinutes: 2160,
      capacityMinutes: 2160,
    });
  });

  it('rechaza cuando "from" es posterior a "to"', async () => {
    const repo = new FakeRepo([]);
    const uc = new GetOccupancyUseCase(repo as any, workers, sinAusencias);

    await expect(uc.execute('2026-04-21', '2026-04-20')).rejects.toThrow(
      BadRequestException,
    );
  });
});

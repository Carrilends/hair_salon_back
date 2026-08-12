import { BadRequestException } from '@nestjs/common';
import { GetOccupancyUseCase } from './get-occupancy.use-case';
import {
  OccupancyMinuteRow,
  ReservationRepositoryPort,
} from '../domain/ports/reservation-repository.port';
import { WorkerAvailabilityPort } from '../domain/ports/worker-availability.port';

// Rango fijo en el pasado (2026-04-20, lunes) para que el ajuste "hoy" no
// aplique: capacidad = estilistas × minutos laborables del día (08:00–21:59 →
// 840 min) y los minutos usados son la duración completa de cada reserva.
class FakeRepo implements Partial<ReservationRepositoryPort> {
  constructor(private readonly rows: OccupancyMinuteRow[]) {}
  findOccupancyRows = async () => this.rows;
}

const workers: WorkerAvailabilityPort = {
  countParallelStylists: async () => 3,
  getDefaultWorkerId: async () => 'default-w',
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
    const uc = new GetOccupancyUseCase(repo as any, workers);

    const result = await uc.execute('2026-04-20', '2026-04-20');

    expect(result.parallelStylists).toBe(3);
    expect(result.salonTimeZone).toBe('America/Bogota');
    expect(result.byDate['2026/04/20']).toEqual({
      usedMinutes: 90, // 60 + 30
      capacityMinutes: 2520, // 3 × 840
    });
  });

  it('rechaza cuando "from" es posterior a "to"', async () => {
    const repo = new FakeRepo([]);
    const uc = new GetOccupancyUseCase(repo as any, workers);

    await expect(uc.execute('2026-04-21', '2026-04-20')).rejects.toThrow(
      BadRequestException,
    );
  });
});

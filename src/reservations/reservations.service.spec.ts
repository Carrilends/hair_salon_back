import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReservationsService } from './reservations.service';
import { Reservation } from './entities/reservation.entity';
import { WorkersService } from 'src/workers/workers.service';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let reservationRepository: jest.Mocked<Partial<Repository<Reservation>>>;
  let workersService: jest.Mocked<Partial<WorkersService>>;

  beforeEach(() => {
    reservationRepository = {
      manager: {
        query: jest.fn(),
      } as any,
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    workersService = {
      countParallelStylists: jest.fn(),
      getDefaultWorker: jest.fn(),
    };

    service = new ReservationsService(
      reservationRepository as any,
      workersService as any,
    );
    process.env.SALON_TZ = 'America/Bogota';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds occupancy with today effective capacity and future-only usage', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T23:00:00.000Z')); // 18:00 Bogota

    (workersService.countParallelStylists as jest.Mock).mockResolvedValue(4);
    (
      reservationRepository.manager!.query as unknown as jest.Mock
    ).mockResolvedValue([
      { d: '2026/04/20', start_min: '1050', end_min: '120' }, // hoy, 17:30-19:30
      { d: '2026/04/21', start_min: '600', end_min: '60' }, // manana
    ]);

    const response = await service.getOccupancy('2026-04-20', '2026-04-21');
    expect(response.salonNow).toEqual({
      ymd: '2026-04-20',
      minOfDay: 18 * 60,
    });
    expect(response.byDate['2026/04/20']).toEqual({
      usedMinutes: 90,
      capacityMinutes: 4 * 240,
    });
    expect(response.byDate['2026/04/21']).toEqual({
      usedMinutes: 60,
      capacityMinutes: 4 * 840,
    });
  });

  it('rejects reservations out of business hours', async () => {
    const dto = {
      scheduledAt: '2026-04-21T03:00:00.000Z', // 22:00 Bogota (fuera de horario)
      totalDurationMinutes: 30,
      workerId: 'w-1',
    };

    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
  });

  it('rejects overlapping reservations for the same worker', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
    };
    (reservationRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const dto = {
      scheduledAt: '2026-04-20T15:00:00.000Z', // 10:00 Bogota
      totalDurationMinutes: 60,
      workerId: 'w-1',
    };

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
  });

  it('creates reservation when in range and without overlap', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    (reservationRepository.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    (reservationRepository.create as jest.Mock).mockImplementation((x) => x);
    (reservationRepository.save as jest.Mock).mockImplementation(async (x) => ({
      id: 'r-1',
      ...x,
    }));

    const dto = {
      scheduledAt: '2026-04-20T15:00:00.000Z', // 10:00 Bogota
      totalDurationMinutes: 60,
      workerId: 'w-1',
    };

    const result = await service.create(dto);

    expect(reservationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: 'w-1',
        totalDurationMinutes: 60,
      }),
    );
    expect(result.id).toBe('r-1');
  });
});

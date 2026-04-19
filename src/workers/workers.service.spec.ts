import { Repository } from 'typeorm';
import { WorkersService } from './workers.service';
import { Worker } from './entities/worker.entity';
import { Reservation } from 'src/reservations/entities/reservation.entity';

describe('WorkersService', () => {
  let service: WorkersService;
  let workerRepository: jest.Mocked<Partial<Repository<Worker>>>;
  let reservationRepository: jest.Mocked<Partial<Repository<Reservation>>>;

  beforeEach(() => {
    workerRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    reservationRepository = {
      manager: {
        query: jest.fn(),
      } as any,
    };

    service = new WorkersService(
      workerRepository as any,
      reservationRepository as any,
    );
    jest.spyOn(service, 'ensureDefaultWorker').mockResolvedValue();
    process.env.SALON_TZ = 'America/Bogota';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('computes effective capacity for today and only counts future reservation minutes', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-20T23:00:00.000Z')); // 18:00 Bogota

    (workerRepository.find as jest.Mock).mockResolvedValue([
      { id: 'w-1', name: 'Ana', isDefault: false },
      { id: 'w-def', name: 'Default', isDefault: true },
    ]);

    (
      reservationRepository.manager!.query as unknown as jest.Mock
    ).mockResolvedValue([
      { worker_id: 'w-1', start_min: '960', duration: '30' }, // pasada
      { worker_id: 'w-1', start_min: '1050', duration: '90' }, // en curso
      { worker_id: 'w-1', start_min: '1110', duration: '90' }, // futura
    ]);

    const result = await service.getAvailabilityByDate('2026-04-20');
    const ana = result.workers.find((w) => w.id === 'w-1');
    const def = result.workers.find((w) => w.id === 'w-def');

    expect(result.dayBounds).toEqual({
      openMin: 8 * 60,
      closeMin: 21 * 60 + 59,
      effectiveStartMin: 18 * 60,
      isToday: true,
    });
    expect(result.salonNow).toEqual({
      ymd: '2026-04-20',
      minOfDay: 18 * 60,
      tz: 'America/Bogota',
    });

    expect(ana).toEqual(
      expect.objectContaining({
        assignable: true,
        capacityMinutes: 240,
        usedMinutes: 150,
        availableMinutes: 90,
      }),
    );
    expect(def).toEqual(
      expect.objectContaining({
        assignable: false,
      }),
    );
  });
});

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
      create: jest.fn(),
      delete: jest.fn(),
    };

    reservationRepository = {
      manager: {
        query: jest.fn(),
      } as any,
      count: jest.fn(),
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

  describe('create', () => {
    it('persiste un nuevo empleado con isDefault=false y nombre recortado', async () => {
      const created = { name: 'Ana', isDefault: false } as Partial<Worker>;
      const saved = { id: 'w-new', name: 'Ana', isDefault: false } as Worker;
      (workerRepository.create as jest.Mock).mockReturnValue(created);
      (workerRepository.save as jest.Mock).mockResolvedValue(saved);

      const result = await service.create({ name: '  Ana  ' });

      expect(workerRepository.create).toHaveBeenCalledWith({
        name: 'Ana',
        isDefault: false,
      });
      expect(workerRepository.save).toHaveBeenCalledWith(created);
      expect(result).toBe(saved);
    });
  });

  describe('update', () => {
    it('actualiza el nombre del empleado y lo persiste recortado', async () => {
      const existing = { id: 'w-1', name: 'Ana', isDefault: false } as Worker;
      (workerRepository.findOne as jest.Mock).mockResolvedValue(existing);
      (workerRepository.save as jest.Mock).mockImplementation(
        async (w: Worker) => w,
      );

      const result = await service.update('w-1', { name: '  Ana María  ' });

      expect(workerRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'w-1' },
      });
      expect(result.name).toBe('Ana María');
      expect(workerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'w-1', name: 'Ana María' }),
      );
    });

    it('lanza NotFoundException si el empleado no existe', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('rechaza eliminar al estilista por defecto con BadRequestException', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'w-def',
        name: 'Estilista default',
        isDefault: true,
      });

      await expect(service.remove('w-def')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(reservationRepository.count).not.toHaveBeenCalled();
      expect(workerRepository.delete).not.toHaveBeenCalled();
    });

    it('rechaza eliminar a un empleado con reservas asociadas con ConflictException', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'w-1',
        name: 'Ana',
        isDefault: false,
      });
      (reservationRepository.count as jest.Mock).mockResolvedValue(2);

      await expect(service.remove('w-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(reservationRepository.count).toHaveBeenCalledWith({
        where: { workerId: 'w-1' },
      });
      expect(workerRepository.delete).not.toHaveBeenCalled();
    });

    it('elimina al empleado sin reservas y devuelve { deleted: true }', async () => {
      (workerRepository.findOne as jest.Mock).mockResolvedValue({
        id: 'w-2',
        name: 'Beatriz',
        isDefault: false,
      });
      (reservationRepository.count as jest.Mock).mockResolvedValue(0);
      (workerRepository.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.remove('w-2');

      expect(workerRepository.delete).toHaveBeenCalledWith('w-2');
      expect(result).toEqual({ deleted: true });
    });
  });
});

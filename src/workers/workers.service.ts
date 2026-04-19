import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from './entities/worker.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { getDayBounds, getSalonNow } from '../reservations/salon-time';

const DEFAULT_WORKER_NAME = 'Estilista default';

export type ReservationBlock = {
  startMin: number;
  endMin: number;
};

export type WorkerAvailabilityEntry = {
  id: string;
  name: string;
  isDefault: boolean;
  assignable: boolean;
  usedMinutes: number;
  capacityMinutes: number;
  availableMinutes: number;
  reservations: ReservationBlock[];
};

export type WorkerAvailabilityResponse = {
  workers: WorkerAvailabilityEntry[];
  dayBounds: {
    openMin: number;
    closeMin: number;
    effectiveStartMin: number;
    isToday: boolean;
  };
  salonNow: {
    ymd: string;
    minOfDay: number;
    tz: string;
  };
};

@Injectable()
export class WorkersService implements OnModuleInit {
  constructor(
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultWorker();
  }

  async ensureDefaultWorker(): Promise<void> {
    const existing = await this.workerRepository.findOne({
      where: { isDefault: true },
    });
    if (existing) return;

    await this.workerRepository.save(
      this.workerRepository.create({
        name: DEFAULT_WORKER_NAME,
        isDefault: true,
      }),
    );
  }

  async getDefaultWorker(): Promise<Worker> {
    await this.ensureDefaultWorker();
    const worker = await this.workerRepository.findOne({
      where: { isDefault: true },
    });
    if (!worker) {
      throw new InternalServerErrorException('Default worker not found');
    }
    return worker;
  }

  async findAll(): Promise<Worker[]> {
    await this.ensureDefaultWorker();
    return this.workerRepository.find({
      order: {
        isDefault: 'DESC',
        name: 'ASC',
      },
    });
  }

  async create(dto: CreateWorkerDto): Promise<Worker> {
    const name = dto.name.trim();
    const worker = this.workerRepository.create({
      name,
      isDefault: false,
    });
    return this.workerRepository.save(worker);
  }

  async update(id: string, dto: UpdateWorkerDto): Promise<Worker> {
    const worker = await this.findById(id);

    if (dto.name !== undefined) {
      worker.name = dto.name.trim();
    }

    return this.workerRepository.save(worker);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const worker = await this.findById(id);

    if (worker.isDefault) {
      throw new BadRequestException('No se puede eliminar el trabajador predeterminado');
    }

    const reservationsCount = await this.reservationRepository.count({
      where: { workerId: worker.id },
    });
    if (reservationsCount > 0) {
      throw new ConflictException(
        'No se puede eliminar el trabajador porque tiene reservas asociadas',
      );
    }

    await this.workerRepository.delete(worker.id);
    return { deleted: true };
  }

  /**
   * Estilistas en paralelo (excluye el worker default).
   * Si no hay ninguno, usa `SALON_PARALLEL_STYLISTS_FALLBACK` (default 3).
   */
  async countParallelStylists(): Promise<number> {
    await this.ensureDefaultWorker();
    const n = await this.workerRepository.count({
      where: { isDefault: false },
    });
    if (n > 0) return n;
    const raw = process.env.SALON_PARALLEL_STYLISTS_FALLBACK ?? '3';
    const fallback = Number.parseInt(raw, 10);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 3;
  }

  async getAvailabilityByDate(
    dateYmd: string,
  ): Promise<WorkerAvailabilityResponse> {
    await this.ensureDefaultWorker();

    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const salonNow = getSalonNow(tz);
    const dayBounds = getDayBounds(dateYmd, tz, salonNow);
    const capacityMinutes = dayBounds.effectiveCapacityMin;

    const workers = await this.workerRepository.find();

    type ResRow = {
      worker_id: string;
      start_min: string;
      duration: string;
    };
    const resRows = (await this.reservationRepository.manager.query(
      `
      SELECT
        worker_id,
        (EXTRACT(HOUR FROM (scheduled_at AT TIME ZONE $1))::int * 60 +
         EXTRACT(MINUTE FROM (scheduled_at AT TIME ZONE $1))::int)::text AS start_min,
        total_duration_minutes::text AS duration
      FROM reservations
      WHERE (scheduled_at AT TIME ZONE $1)::date = $2::date
      `,
      [tz, dateYmd],
    )) as ResRow[];

    const workerBlocks = new Map<string, ReservationBlock[]>();
    const workerUsed = new Map<string, number>();

    for (const row of resRows) {
      const wId = row.worker_id;
      const startMin = Number(row.start_min);
      const duration = Number(row.duration);
      const endMin = startMin + duration;

      if (!workerBlocks.has(wId)) workerBlocks.set(wId, []);
      workerBlocks.get(wId)!.push({ startMin, endMin });

      if (dayBounds.isToday) {
        if (endMin > salonNow.minOfDay) {
          const futurePortionStart = Math.max(startMin, salonNow.minOfDay);
          workerUsed.set(
            wId,
            (workerUsed.get(wId) ?? 0) + (endMin - futurePortionStart),
          );
        }
      } else {
        workerUsed.set(wId, (workerUsed.get(wId) ?? 0) + duration);
      }
    }

    return {
      workers: workers.map((w) => {
        const usedMinutes = workerUsed.get(w.id) ?? 0;
        const availableMinutes = Math.max(0, capacityMinutes - usedMinutes);
        return {
          id: w.id,
          name: w.name,
          isDefault: w.isDefault,
          assignable: !w.isDefault,
          usedMinutes,
          capacityMinutes,
          availableMinutes,
          reservations: workerBlocks.get(w.id) ?? [],
        };
      }),
      dayBounds: {
        openMin: dayBounds.openMin,
        closeMin: dayBounds.closeMin,
        effectiveStartMin: dayBounds.effectiveStartMin,
        isToday: dayBounds.isToday,
      },
      salonNow: {
        ymd: salonNow.ymd,
        minOfDay: salonNow.minOfDay,
        tz,
      },
    };
  }

  private async findById(id: string): Promise<Worker> {
    const worker = await this.workerRepository.findOne({
      where: { id },
    });
    if (!worker) {
      throw new NotFoundException(`Worker with id ${id} not found`);
    }
    return worker;
  }
}

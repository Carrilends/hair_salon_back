import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from './entities/worker.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import {
  isWeekendYmd,
  WEEKDAY_OPEN_MIN,
  WEEKDAY_CLOSE_MIN,
  WEEKEND_OPEN_MIN,
  WEEKEND_CLOSE_MIN,
} from '../reservations/salon-schedule';

const DEFAULT_WORKER_NAME = 'Estilista default';

export type ReservationBlock = {
  startMin: number;
  endMin: number;
};

export type WorkerAvailabilityEntry = {
  id: string;
  name: string;
  isDefault: boolean;
  usedMinutes: number;
  capacityMinutes: number;
  availableMinutes: number;
  reservations: ReservationBlock[];
};

export type WorkerAvailabilityResponse = {
  workers: WorkerAvailabilityEntry[];
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

    const [yStr, mStr, dStr] = dateYmd.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const tz = process.env.SALON_TZ ?? 'America/Bogota';

    const weekend = isWeekendYmd(y, m, d);
    const openMin = weekend ? WEEKEND_OPEN_MIN : WEEKDAY_OPEN_MIN;
    const closeMin = weekend ? WEEKEND_CLOSE_MIN : WEEKDAY_CLOSE_MIN;

    const now = new Date();
    const salonNowStr = now.toLocaleString('en-US', { timeZone: tz });
    const salonNow = new Date(salonNowStr);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const salonTodayYmd = `${salonNow.getFullYear()}-${pad2(salonNow.getMonth() + 1)}-${pad2(salonNow.getDate())}`;
    const isToday = dateYmd === salonTodayYmd;
    const nowMin = salonNow.getHours() * 60 + salonNow.getMinutes();

    const effectiveStart = isToday ? Math.max(openMin, nowMin) : openMin;
    const capacityMinutes = Math.max(0, closeMin - effectiveStart + 1);

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

      if (isToday) {
        if (endMin > nowMin) {
          const futurePortionStart = Math.max(startMin, nowMin);
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
          usedMinutes,
          capacityMinutes,
          availableMinutes,
          reservations: workerBlocks.get(w.id) ?? [],
        };
      }),
    };
  }
}

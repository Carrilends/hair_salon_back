import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkersService } from 'src/workers/workers.service';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { laborMinutesForCalendarDay } from './salon-schedule';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseYmdHyphen(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map((x) => Number(x));
  return { y, m, d };
}

function parseQDateKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('/').map((x) => Number(x));
  return { y, m, d };
}

/** Itera claves `YYYY/MM/DD` (QDate) desde `from` hasta `to` inclusive (YYYY-MM-DD). */
function* iterateQDateKeysInRange(
  fromYmd: string,
  toYmd: string,
): Generator<string> {
  const a = parseYmdHyphen(fromYmd);
  const b = parseYmdHyphen(toYmd);
  let cur = new Date(Date.UTC(a.y, a.m - 1, a.d));
  const end = new Date(Date.UTC(b.y, b.m - 1, b.d));
  if (cur > end) return;
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth() + 1;
    const d = cur.getUTCDate();
    yield `${y}/${pad2(m)}/${pad2(d)}`;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

export type OccupancyByDateEntry = {
  usedMinutes: number;
  capacityMinutes: number;
};

export type OccupancyResponse = {
  parallelStylists: number;
  salonTimeZone: string;
  byDate: Record<string, OccupancyByDateEntry>;
};

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly workersService: WorkersService,
  ) {}

  async getOccupancy(from: string, to: string): Promise<OccupancyResponse> {
    const start = parseYmdHyphen(from);
    const end = parseYmdHyphen(to);
    const startTime = new Date(Date.UTC(start.y, start.m - 1, start.d)).getTime();
    const endTime = new Date(Date.UTC(end.y, end.m - 1, end.d)).getTime();
    if (startTime > endTime) {
      throw new BadRequestException('"from" must be <= "to"');
    }

    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const parallelStylists = await this.workersService.countParallelStylists();

    type Row = { d: string; used: string };
    const rows = (await this.reservationRepository.manager.query(
      `
      SELECT
        TO_CHAR(sub.local_day, 'YYYY/MM/DD') AS d,
        COALESCE(SUM(sub.total_duration_minutes), 0)::text AS used
      FROM (
        SELECT
          total_duration_minutes,
          (scheduled_at AT TIME ZONE $1)::date AS local_day
        FROM reservations
        WHERE (scheduled_at AT TIME ZONE $1)::date >= $2::date
          AND (scheduled_at AT TIME ZONE $1)::date <= $3::date
      ) AS sub
      GROUP BY sub.local_day
      `,
      [tz, from, to],
    )) as Row[];

    const usedMap = new Map<string, number>();
    for (const row of rows) {
      usedMap.set(row.d, Number.parseInt(row.used, 10) || 0);
    }

    const byDate: Record<string, OccupancyByDateEntry> = {};
    for (const key of iterateQDateKeysInRange(from, to)) {
      const { y, m, d } = parseQDateKey(key);
      const L = laborMinutesForCalendarDay(y, m, d);
      const capacityMinutes = parallelStylists * L;
      const usedMinutes = usedMap.get(key) ?? 0;
      byDate[key] = { usedMinutes, capacityMinutes };
    }

    return {
      parallelStylists,
      salonTimeZone: tz,
      byDate,
    };
  }

  async create(dto: CreateReservationDto): Promise<Reservation> {
    const worker = await this.workersService.getDefaultWorker();
    const scheduledAt = new Date(dto.scheduledAt);
    const endedAt = new Date(
      scheduledAt.getTime() + dto.totalDurationMinutes * 60 * 1000,
    );
    const entity = this.reservationRepository.create({
      scheduledAt,
      endedAt,
      workerId: worker.id,
      totalDurationMinutes: dto.totalDurationMinutes,
    });
    return this.reservationRepository.save(entity);
  }
}

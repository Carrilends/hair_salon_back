import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { WorkersService } from 'src/workers/workers.service';
import { Reservation } from './entities/reservation.entity';
import { CreateReservationDto } from './dto/create-reservation.dto';
import {
  getDatePartsInTz,
  getDayBounds,
  getSalonNow,
} from './salon-time';

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
  const cur = new Date(Date.UTC(a.y, a.m - 1, a.d));
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
  salonNow: {
    ymd: string;
    minOfDay: number;
  };
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
    const startTime = new Date(
      Date.UTC(start.y, start.m - 1, start.d),
    ).getTime();
    const endTime = new Date(Date.UTC(end.y, end.m - 1, end.d)).getTime();
    if (startTime > endTime) {
      throw new BadRequestException('"from" must be <= "to"');
    }

    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const parallelStylists = await this.workersService.countParallelStylists();
    const salonNow = getSalonNow(tz);
    const salonTodayKey = salonNow.qdateKey;

    type Row = {
      d: string;
      start_min: string;
      end_min: string;
    };
    const rows = (await this.reservationRepository.manager.query(
      `
      SELECT
        TO_CHAR((scheduled_at AT TIME ZONE $1)::date, 'YYYY/MM/DD') AS d,
        (EXTRACT(HOUR FROM (scheduled_at AT TIME ZONE $1))::int * 60 +
         EXTRACT(MINUTE FROM (scheduled_at AT TIME ZONE $1))::int)::text AS start_min,
        total_duration_minutes::text AS end_min
      FROM reservations
      WHERE (scheduled_at AT TIME ZONE $1)::date >= $2::date
        AND (scheduled_at AT TIME ZONE $1)::date <= $3::date
      `,
      [tz, from, to],
    )) as Row[];

    const usedByDate = new Map<string, number>();
    for (const row of rows) {
      const resStart = Number(row.start_min);
      const duration = Number(row.end_min);
      const resEnd = resStart + duration;
      const isToday = row.d === salonTodayKey;

      let effective = 0;
      if (isToday) {
        if (resEnd > salonNow.minOfDay) {
          effective = resEnd - Math.max(resStart, salonNow.minOfDay);
        }
      } else {
        effective = duration;
      }
      usedByDate.set(row.d, (usedByDate.get(row.d) ?? 0) + effective);
    }

    const byDate: Record<string, OccupancyByDateEntry> = {};
    for (const key of iterateQDateKeysInRange(from, to)) {
      const { y, m, d } = parseQDateKey(key);
      const bounds = getDayBounds(`${y}-${pad2(m)}-${pad2(d)}`, tz, salonNow);
      const capacityMinutes = parallelStylists * bounds.effectiveCapacityMin;

      const usedMinutes = usedByDate.get(key) ?? 0;
      byDate[key] = { usedMinutes, capacityMinutes };
    }

    return {
      parallelStylists,
      salonTimeZone: tz,
      salonNow: {
        ymd: salonNow.ymd,
        minOfDay: salonNow.minOfDay,
      },
      byDate,
    };
  }

  async findAll(): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { endedAt: MoreThan(new Date()) },
      relations: ['worker'],
      order: { scheduledAt: 'DESC' },
    });
  }

  /** Elimina reservas cuya ventana terminó hace más de un mes (PostgreSQL `INTERVAL '1 month'`). */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeReservationsOlderThanOneMonth(): Promise<void> {
    await this.reservationRepository
      .createQueryBuilder()
      .delete()
      .from(Reservation)
      .where("ended_at < NOW() - INTERVAL '1 month'")
      .execute();
  }

  async remove(id: string): Promise<void> {
    const reservation = await this.reservationRepository.findOneBy({ id });
    if (!reservation) {
      throw new NotFoundException(`Reservation ${id} not found`);
    }
    await this.reservationRepository.remove(reservation);
  }

  async create(dto: CreateReservationDto): Promise<Reservation> {
    const workerId =
      dto.workerId ?? (await this.workersService.getDefaultWorker()).id;
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt is invalid');
    }
    const endedAt = new Date(
      scheduledAt.getTime() + dto.totalDurationMinutes * 60 * 1000,
    );

    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const scheduledParts = getDatePartsInTz(scheduledAt, tz);
    const scheduledYmd = `${scheduledParts.year}-${pad2(scheduledParts.month)}-${pad2(scheduledParts.day)}`;
    const bounds = getDayBounds(scheduledYmd, tz);
    const startMin = scheduledParts.hour * 60 + scheduledParts.minute;
    const endMin = startMin + dto.totalDurationMinutes;

    if (startMin < bounds.openMin || endMin - 1 > bounds.closeMin) {
      throw new BadRequestException(
        'La reserva está fuera del horario laboral del salón',
      );
    }

    const overlapCount = await this.reservationRepository
      .createQueryBuilder('r')
      .where('r.worker_id = :workerId', { workerId })
      .andWhere('r.scheduled_at < :endedAt', { endedAt: endedAt.toISOString() })
      .andWhere('r.ended_at > :scheduledAt', {
        scheduledAt: scheduledAt.toISOString(),
      })
      .getCount();

    if (overlapCount > 0) {
      throw new ConflictException(
        'El estilista ya tiene una reserva en ese horario',
      );
    }

    const entity = this.reservationRepository.create({
      scheduledAt,
      endedAt,
      workerId,
      totalDurationMinutes: dto.totalDurationMinutes,
    });
    return this.reservationRepository.save(entity);
  }
}

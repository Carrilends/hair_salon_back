import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { WorkerAvailabilityPort } from '../domain/ports/worker-availability.port';
import { RESERVATION_REPOSITORY, WORKER_AVAILABILITY } from './tokens';
import { getDayBounds, getSalonNow } from '../salon-time';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function* iterateKeys(fromYmd: string, toYmd: string): Generator<string> {
  const [ay, am, ad] = fromYmd.split('-').map(Number);
  const [by, bm, bd] = toYmd.split('-').map(Number);
  const cur = new Date(Date.UTC(ay, am - 1, ad));
  const end = new Date(Date.UTC(by, bm - 1, bd));
  while (cur <= end) {
    yield `${cur.getUTCFullYear()}/${pad2(cur.getUTCMonth() + 1)}/${pad2(
      cur.getUTCDate(),
    )}`;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

@Injectable()
export class GetOccupancyUseCase {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(WORKER_AVAILABILITY)
    private readonly workers: WorkerAvailabilityPort,
  ) {}

  async execute(from: string, to: string) {
    if (from > to) throw new BadRequestException('"from" must be <= "to"');
    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const parallelStylists = await this.workers.countParallelStylists();
    const salonNow = getSalonNow(tz);
    const rows = await this.repository.findOccupancyRows(from, to, tz);

    const usedByDate = new Map<string, number>();
    for (const row of rows) {
      const resEnd = row.startMin + row.durationMin;
      let effective = row.durationMin;
      if (row.dateKey === salonNow.qdateKey) {
        effective =
          resEnd > salonNow.minOfDay
            ? resEnd - Math.max(row.startMin, salonNow.minOfDay)
            : 0;
      }
      usedByDate.set(
        row.dateKey,
        (usedByDate.get(row.dateKey) ?? 0) + effective,
      );
    }

    const byDate: Record<
      string,
      { usedMinutes: number; capacityMinutes: number }
    > = {};
    for (const key of iterateKeys(from, to)) {
      const [y, m, d] = key.split('/').map(Number);
      const bounds = getDayBounds(`${y}-${pad2(m)}-${pad2(d)}`, tz, salonNow);
      byDate[key] = {
        usedMinutes: usedByDate.get(key) ?? 0,
        capacityMinutes: parallelStylists * bounds.effectiveCapacityMin,
      };
    }
    return {
      parallelStylists,
      salonTimeZone: tz,
      salonNow: { ymd: salonNow.ymd, minOfDay: salonNow.minOfDay },
      byDate,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ReservationOrmEntity } from './reservation.orm-entity';
import { ReservationMapper } from './reservation.mapper';
import { Reservation } from '../../domain/reservation';
import {
  OccupancyMinuteRow,
  ReservationRepositoryPort,
  ReservationView,
} from '../../domain/ports/reservation-repository.port';

@Injectable()
export class TypeOrmReservationRepository implements ReservationRepositoryPort {
  constructor(
    @InjectRepository(ReservationOrmEntity)
    private readonly repo: Repository<ReservationOrmEntity>,
  ) {}

  async save(reservation: Reservation): Promise<Reservation> {
    const entity = this.repo.create(ReservationMapper.toOrm(reservation));
    const saved = await this.repo.save(entity);
    return ReservationMapper.toDomain(saved);
  }

  countOverlaps(
    workerId: string,
    scheduledAt: Date,
    endedAt: Date,
  ): Promise<number> {
    return this.repo
      .createQueryBuilder('r')
      .where('r.worker_id = :workerId', { workerId })
      .andWhere('r.scheduled_at < :endedAt', { endedAt: endedAt.toISOString() })
      .andWhere('r.ended_at > :scheduledAt', {
        scheduledAt: scheduledAt.toISOString(),
      })
      .getCount();
  }

  async findActiveWithWorker(now: Date): Promise<ReservationView[]> {
    const rows = await this.repo.find({
      where: { endedAt: MoreThan(now) },
      relations: ['worker'],
      order: { scheduledAt: 'DESC' },
    });
    return rows.map((r) => ({
      id: r.id,
      scheduledAt: r.scheduledAt,
      endedAt: r.endedAt,
      workerId: r.workerId,
      totalDurationMinutes: r.totalDurationMinutes,
      worker: {
        id: r.worker.id,
        name: r.worker.name,
        isDefault: r.worker.isDefault,
      },
    }));
  }

  async findOccupancyRows(
    fromYmd: string,
    toYmd: string,
    tz: string,
  ): Promise<OccupancyMinuteRow[]> {
    type Row = { d: string; start_min: string; end_min: string };
    const rows = (await this.repo.manager.query(
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
      [tz, fromYmd, toYmd],
    )) as Row[];
    return rows.map((r) => ({
      dateKey: r.d,
      startMin: Number(r.start_min),
      durationMin: Number(r.end_min),
    }));
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async deleteEndedBefore(cutoff: Date): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .delete()
      .from(ReservationOrmEntity)
      .where('ended_at < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();
  }
}

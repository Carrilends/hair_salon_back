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
    const full = await this.repo.findOne({
      where: { id: saved.id },
      relations: ['services'],
    });
    return ReservationMapper.toDomain(full ?? saved);
  }

  async findById(id: string): Promise<Reservation | null> {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['services'],
    });
    return row ? ReservationMapper.toDomain(row) : null;
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
      .andWhere("r.status <> 'cancelada'")
      .getCount();
  }

  async findActiveWithWorker(now: Date): Promise<ReservationView[]> {
    const rows = await this.repo.find({
      where: { endedAt: MoreThan(now) },
      relations: ['worker', 'services'],
      order: { scheduledAt: 'DESC' },
    });
    return rows.map((r) => this.toView(r));
  }

  async findByUser(userId: string): Promise<ReservationView[]> {
    const rows = await this.repo.find({
      where: { userId },
      relations: ['worker', 'services'],
      order: { scheduledAt: 'DESC' },
    });
    return rows.map((r) => this.toView(r));
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
        AND status <> 'cancelada'
      `,
      [tz, fromYmd, toYmd],
    )) as Row[];
    return rows.map((r) => ({
      dateKey: r.d,
      startMin: Number(r.start_min),
      durationMin: Number(r.end_min),
    }));
  }

  async markFulfilledEndedBefore(now: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ status: 'cumplida' })
      .where('ended_at < :now', { now: now.toISOString() })
      .andWhere("status IN ('pendiente','confirmada')")
      .execute();
    return result.affected ?? 0;
  }

  async deleteEndedBefore(cutoff: Date): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .delete()
      .from(ReservationOrmEntity)
      .where('ended_at < :cutoff', { cutoff: cutoff.toISOString() })
      .execute();
  }

  private toView(r: ReservationOrmEntity): ReservationView {
    return {
      id: r.id,
      scheduledAt: r.scheduledAt,
      endedAt: r.endedAt,
      workerId: r.workerId,
      totalDurationMinutes: r.totalDurationMinutes,
      status: r.status,
      userId: r.userId,
      contact:
        r.customerName || r.customerPhone
          ? {
              name: r.customerName ?? '',
              phone: r.customerPhone ?? '',
              email: r.customerEmail,
            }
          : null,
      worker: r.worker
        ? { id: r.worker.id, name: r.worker.name, isDefault: r.worker.isDefault }
        : { id: r.workerId, name: '', isDefault: false },
      services: (r.services ?? []).map((s) => ({
        serviceId: s.serviceId,
        name: s.name,
        price: Number(s.price),
        durationMinutes: s.durationMinutes,
      })),
    };
  }
}

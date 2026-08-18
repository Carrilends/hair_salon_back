import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { ReservationOrmEntity } from './reservation.orm-entity';
import { ReservationMapper } from './reservation.mapper';
import { Reservation } from '../../domain/reservation';
import { WorkerOverlapError } from '../../domain/errors';
import {
  OccupancyMinuteRow,
  ReservationRepositoryPort,
  ReservationView,
} from '../../domain/ports/reservation-repository.port';

/** Código SQLSTATE de Postgres para violación de constraint de exclusión. */
const PG_EXCLUSION_VIOLATION = '23P01';

@Injectable()
export class TypeOrmReservationRepository implements ReservationRepositoryPort {
  constructor(
    @InjectRepository(ReservationOrmEntity)
    private readonly repo: Repository<ReservationOrmEntity>,
  ) {}

  async save(reservation: Reservation): Promise<Reservation> {
    let id: string;
    if (reservation.id) {
      // Reserva existente: solo cambian columnas escalares (p. ej. `status`). NO
      // se tocan las líneas de servicio: son inmutables y, con `cascade: true`
      // sin `orphanedRowAction`, volver a pasarlas por `save` las reinsertaría,
      // duplicando `reservation_services` en cada confirm/cancel (hallazgo A1).
      await this.repo.update(
        reservation.id,
        ReservationMapper.toOrmScalars(reservation),
      );
      id = reservation.id;
    } else {
      try {
        const entity = this.repo.create(ReservationMapper.toOrm(reservation));
        const saved = await this.repo.save(entity);
        id = saved.id;
      } catch (err) {
        // El constraint de exclusión (btree_gist) rechaza dos reservas no
        // canceladas que se solapan en el mismo estilista: es el backstop de la
        // carrera entre countOverlaps y el insert. Se traduce a error de dominio.
        const code =
          (err as { driverError?: { code?: string } })?.driverError?.code ??
          (err as { code?: string })?.code;
        if (code === PG_EXCLUSION_VIOLATION) throw new WorkerOverlapError();
        throw err;
      }
    }
    const full = await this.repo.findOne({
      where: { id },
      relations: ['services'],
    });
    return ReservationMapper.toDomain(full!);
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
      // Vigentes = ventana aún no terminada y NO cancelada. Coherente con
      // `countOverlaps` y `findOccupancyRows`, que ya excluyen las canceladas.
      where: { endedAt: MoreThan(now), status: Not('cancelada') },
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

  async settlePastReservations(now: Date): Promise<number> {
    // Reservas cuya ventana ya terminó: las confirmadas se dan por cumplidas; las
    // que nunca se confirmaron (pendientes) se cancelan (expiran). No se tocan
    // las ya terminales. Ambas transiciones son válidas en la máquina de estados
    // (§6.4); el cron nunca ejecuta el prohibido pendiente→cumplida.
    const fulfilled = await this.repo.update(
      { endedAt: LessThan(now), status: 'confirmada' },
      { status: 'cumplida' },
    );
    const cancelled = await this.repo.update(
      { endedAt: LessThan(now), status: 'pendiente' },
      { status: 'cancelada' },
    );
    return (fulfilled.affected ?? 0) + (cancelled.affected ?? 0);
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
        ? {
            id: r.worker.id,
            name: r.worker.name,
            isDefault: r.worker.isDefault,
          }
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

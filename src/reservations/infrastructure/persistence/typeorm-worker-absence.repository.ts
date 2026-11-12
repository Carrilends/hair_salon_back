import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { WorkerAbsenceOrmEntity } from './worker-absence.orm-entity';
import { WorkerAbsence } from '../../domain/worker-absence';
import { AbsenceOverlapError } from '../../domain/errors';
import { WorkerAbsenceRepositoryPort } from '../../domain/ports/worker-absence-repository.port';

/** SQLSTATE de Postgres para violación de restricción de exclusión. */
const PG_EXCLUSION_VIOLATION = '23P01';

function aDominio(e: WorkerAbsenceOrmEntity): WorkerAbsence {
  return WorkerAbsence.fromPersistence({
    id: e.id,
    workerId: e.workerId,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
  });
}

@Injectable()
export class TypeOrmWorkerAbsenceRepository
  implements WorkerAbsenceRepositoryPort
{
  constructor(
    @InjectRepository(WorkerAbsenceOrmEntity)
    private readonly repo: Repository<WorkerAbsenceOrmEntity>,
  ) {}

  async save(a: WorkerAbsence): Promise<WorkerAbsence> {
    try {
      const saved = await this.repo.save(
        this.repo.create({
          id: a.id ?? undefined,
          workerId: a.workerId,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
        }),
      );
      return aDominio(saved);
    } catch (err) {
      const code =
        (err as { driverError?: { code?: string } })?.driverError?.code ??
        (err as { code?: string })?.code;
      if (code === PG_EXCLUSION_VIOLATION) throw new AbsenceOverlapError();
      throw err;
    }
  }

  async delete(id: string): Promise<boolean> {
    const r = await this.repo.delete(id);
    return (r.affected ?? 0) > 0;
  }

  async findById(id: string): Promise<WorkerAbsence | null> {
    const e = await this.repo.findOne({ where: { id } });
    return e ? aDominio(e) : null;
  }

  async listUpcoming(now: Date): Promise<WorkerAbsence[]> {
    const rows = await this.repo.find({
      where: { endsAt: MoreThan(now) },
      order: { startsAt: 'ASC' },
    });
    return rows.map(aDominio);
  }

  async overlapsAny(
    workerId: string,
    start: Date,
    end: Date,
  ): Promise<boolean> {
    return this.repo
      .createQueryBuilder('a')
      .where('a.worker_id = :workerId', { workerId })
      .andWhere('a.starts_at < :end AND a.ends_at > :start', { start, end })
      .getExists();
  }

  async blocksForDate(
    dateYmd: string,
    tz: string,
  ): Promise<{ workerId: string; startMin: number; endMin: number }[]> {
    // Hora local del salón de cada extremo, en minutos desde la medianoche del
    // día pedido, recortada a [0, 1440].
    const rows: { worker_id: string; start_min: string; end_min: string }[] =
      await this.repo.query(
        `SELECT worker_id,
                GREATEST(0, ROUND(EXTRACT(EPOCH FROM ((starts_at AT TIME ZONE $2) - $1::date::timestamp)) / 60)) AS start_min,
                LEAST(1440, ROUND(EXTRACT(EPOCH FROM ((ends_at AT TIME ZONE $2) - $1::date::timestamp)) / 60)) AS end_min
           FROM worker_absences
          WHERE (starts_at AT TIME ZONE $2) < $1::date::timestamp + interval '1 day'
            AND (ends_at AT TIME ZONE $2) > $1::date::timestamp
          ORDER BY starts_at`,
        [dateYmd, tz],
      );
    return rows.map((r) => ({
      workerId: r.worker_id,
      startMin: Number(r.start_min),
      endMin: Number(r.end_min),
    }));
  }

  async minutesByWorkerAndDate(
    fromYmd: string,
    toYmd: string,
    tz: string,
  ): Promise<{ workerId: string; dateYmd: string; minutes: number }[]> {
    const rows: { worker_id: string; d: string; minutes: string }[] =
      await this.repo.query(
        `SELECT worker_id,
                to_char(starts_at AT TIME ZONE $3, 'YYYY-MM-DD') AS d,
                SUM(ROUND(EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60)) AS minutes
           FROM worker_absences
          WHERE (starts_at AT TIME ZONE $3)::date BETWEEN $1::date AND $2::date
          GROUP BY worker_id, d
          ORDER BY d, worker_id`,
        [fromYmd, toYmd, tz],
      );
    return rows.map((r) => ({
      workerId: r.worker_id,
      dateYmd: r.d,
      minutes: Number(r.minutes),
    }));
  }
}

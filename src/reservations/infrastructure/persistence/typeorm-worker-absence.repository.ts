import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { WorkerAbsenceOrmEntity } from './worker-absence.orm-entity';
import { WorkerAbsence } from '../../domain/worker-absence';
import { AbsenceOverlapError } from '../../domain/errors';
import {
  SQL_BLOQUES_DE_AUSENCIA_DEL_DIA,
  SQL_MINUTOS_DE_AUSENCIA_POR_DIA,
} from './worker-absence.sql';
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
      await this.repo.query(SQL_BLOQUES_DE_AUSENCIA_DEL_DIA, [dateYmd, tz]);
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
      await this.repo.query(SQL_MINUTOS_DE_AUSENCIA_POR_DIA, [
        fromYmd,
        toYmd,
        tz,
      ]);
    return rows.map((r) => ({
      workerId: r.worker_id,
      dateYmd: r.d,
      minutes: Number(r.minutes),
    }));
  }
}

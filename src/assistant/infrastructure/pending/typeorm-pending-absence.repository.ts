import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  ConsumeAbsenceResult,
  PendingAbsence,
  PendingAbsenceOutcome,
} from '../../domain/pending-absence';
import { PendingAbsenceRepositoryPort } from '../../domain/ports/pending-absence-repository.port';
import { PendingAbsenceOrmEntity } from './pending-absence.orm-entity';

@Injectable()
export class TypeOrmPendingAbsenceRepository
  implements PendingAbsenceRepositoryPort
{
  constructor(
    @InjectRepository(PendingAbsenceOrmEntity)
    private readonly repo: Repository<PendingAbsenceOrmEntity>,
  ) {}

  async save(absence: Omit<PendingAbsence, 'id'>): Promise<PendingAbsence> {
    const fila = await this.repo.save(
      this.repo.create({ ...absence, usedAt: null, outcome: null }),
    );
    return aDominio(fila);
  }

  async consume(
    id: string,
    phoneE164: string,
    now: Date,
    outcome: PendingAbsenceOutcome,
  ): Promise<ConsumeAbsenceResult> {
    // UN solo UPDATE con todas las condiciones, como las propuestas de
    // reserva: dos toques simultáneos se serializan sobre la fila y el segundo
    // ya no cumple `used_at IS NULL`. Es lo que impide aplicar dos veces.
    const r = await this.repo
      .createQueryBuilder()
      .update(PendingAbsenceOrmEntity)
      .set({ usedAt: now, outcome })
      .where('id = :id', { id })
      .andWhere('phone_e164 = :phoneE164', { phoneE164 })
      .andWhere('used_at IS NULL')
      .andWhere('expires_at > :now', { now: now.toISOString() })
      .returning('*')
      .execute();

    const fila = (r.raw as Record<string, unknown>[])[0];
    if (fila) return { ok: true, absence: deFilaCruda(fila) };

    // No se consumió: averiguar por qué, solo para el mensaje y el log.
    const existente = await this.repo.findOne({ where: { id } });
    if (!existente) return { ok: false, motivo: 'no_encontrada' };
    if (existente.phoneE164 !== phoneE164) {
      return { ok: false, motivo: 'otro_numero' };
    }
    if (existente.usedAt) return { ok: false, motivo: 'usada' };
    return { ok: false, motivo: 'vencida' };
  }

  async supersedeActiveFor(phoneE164: string, now: Date): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(PendingAbsenceOrmEntity)
      .set({ usedAt: now, outcome: 'reemplazada' })
      .where('phone_e164 = :phoneE164', { phoneE164 })
      .andWhere('used_at IS NULL')
      .execute();
  }

  async purgeExpiredBefore(before: Date): Promise<number> {
    const r = await this.repo.delete({ expiresAt: LessThan(before) });
    return r.affected ?? 0;
  }
}

function aDominio(f: PendingAbsenceOrmEntity): PendingAbsence {
  return {
    id: f.id,
    phoneE164: f.phoneE164,
    workerId: f.workerId,
    startsAt: f.startsAt,
    endsAt: f.endsAt,
    expiresAt: f.expiresAt,
  };
}

/** `RETURNING *` devuelve columnas de la tabla, no propiedades de la entidad. */
function deFilaCruda(f: Record<string, unknown>): PendingAbsence {
  return {
    id: f.id as string,
    phoneE164: f.phone_e164 as string,
    workerId: f.worker_id as string,
    startsAt: new Date(f.starts_at as string | Date),
    endsAt: new Date(f.ends_at as string | Date),
    expiresAt: new Date(f.expires_at as string | Date),
  };
}

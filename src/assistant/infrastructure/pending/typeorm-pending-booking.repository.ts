import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  ConsumeResult,
  PendingBooking,
  PendingBookingOutcome,
} from '../../domain/pending-booking';
import { PendingBookingRepositoryPort } from '../../domain/ports/pending-booking-repository.port';
import { PendingBookingOrmEntity } from './pending-booking.orm-entity';

@Injectable()
export class TypeOrmPendingBookingRepository
  implements PendingBookingRepositoryPort
{
  constructor(
    @InjectRepository(PendingBookingOrmEntity)
    private readonly repo: Repository<PendingBookingOrmEntity>,
  ) {}

  async save(booking: Omit<PendingBooking, 'id'>): Promise<PendingBooking> {
    const fila = await this.repo.save(
      this.repo.create({ ...booking, usedAt: null, outcome: null }),
    );
    return aDominio(fila);
  }

  async consume(
    id: string,
    phoneE164: string,
    now: Date,
    outcome: PendingBookingOutcome,
  ): Promise<ConsumeResult> {
    // UN solo UPDATE con todas las condiciones: si dos pulsaciones llegan a la
    // vez, Postgres serializa las dos escrituras sobre la misma fila y la
    // segunda ya no cumple `used_at IS NULL`. Comprobar y luego escribir, en
    // dos pasos, dejaría pasar a las dos.
    const r = await this.repo
      .createQueryBuilder()
      .update(PendingBookingOrmEntity)
      .set({ usedAt: now, outcome })
      .where('id = :id', { id })
      .andWhere('phone_e164 = :phoneE164', { phoneE164 })
      .andWhere('used_at IS NULL')
      .andWhere('expires_at > :now', { now: now.toISOString() })
      .returning('*')
      .execute();

    const fila = (r.raw as Record<string, unknown>[])[0];
    if (fila) return { ok: true, booking: deFilaCruda(fila) };

    // No se consumió: averiguar por qué, solo para el mensaje y el log.
    const existente = await this.repo.findOne({ where: { id } });
    if (!existente) return { ok: false, motivo: 'no_encontrada' };
    if (existente.phoneE164 !== phoneE164) {
      return { ok: false, motivo: 'otro_numero' };
    }
    if (existente.usedAt) return { ok: false, motivo: 'usada' };
    return { ok: false, motivo: 'vencida' };
  }

  async purgeExpiredBefore(before: Date): Promise<number> {
    const r = await this.repo.delete({ expiresAt: LessThan(before) });
    return r.affected ?? 0;
  }
}

function aDominio(f: PendingBookingOrmEntity): PendingBooking {
  return {
    id: f.id,
    phoneE164: f.phoneE164,
    customerName: f.customerName,
    serviceIds: f.serviceIds,
    scheduledAt: f.scheduledAt,
    expiresAt: f.expiresAt,
  };
}

/** `RETURNING *` devuelve columnas de la tabla, no propiedades de la entidad. */
function deFilaCruda(f: Record<string, unknown>): PendingBooking {
  return {
    id: f.id as string,
    phoneE164: f.phone_e164 as string,
    customerName: f.customer_name as string,
    serviceIds: f.service_ids as string[],
    scheduledAt: new Date(f.scheduled_at as string | Date),
    expiresAt: new Date(f.expires_at as string | Date),
  };
}

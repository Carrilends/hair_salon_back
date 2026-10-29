import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ReservationOrmEntity } from 'src/reservations/infrastructure/persistence/reservation.orm-entity';
import {
  AccountContact,
  handOverFor,
  isLiveReservation,
} from '../../domain/account-deletion';
import { AccountReservationsPort } from '../../domain/ports/account-reservations.port';

/**
 * Único punto donde Auth toca la tabla de reservas al eliminar una cuenta. Usa
 * solo el `tx` recibido: un repositorio inyectado saldría de la transacción.
 */
@Injectable()
export class AccountReservationsAdapter implements AccountReservationsPort {
  async handOverAndDetach(
    tx: EntityManager,
    userId: string,
    account: AccountContact,
    now: Date,
  ): Promise<{ vigentes: number; detached: number }> {
    const repo = tx.getRepository(ReservationOrmEntity);
    // FOR UPDATE: que nadie reprograme ni cancele entre la lectura y la copia.
    // Sin las relaciones ansiosas (`services`): Postgres no admite FOR UPDATE
    // sobre el lado nulable de un LEFT JOIN.
    const filas = await repo.find({
      select: {
        id: true,
        status: true,
        endedAt: true,
        customerName: true,
        customerPhoneE164: true,
        customerEmail: true,
      },
      where: { userId },
      loadEagerRelations: false,
      lock: { mode: 'pessimistic_write' },
    });

    let vigentes = 0;
    for (const fila of filas) {
      if (isLiveReservation(fila, now)) vigentes += 1;
      const cambios = handOverFor(fila, account, now);
      if (Object.keys(cambios).length > 0) {
        await repo.update({ id: fila.id }, cambios);
      }
    }
    return { vigentes, detached: filas.length };
  }
}

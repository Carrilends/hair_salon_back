import { DeepPartial } from 'typeorm';
import { Reservation } from '../../domain/reservation';
import { ReservationStatus } from '../../domain/reservation-status';
import { ReservationOrmEntity } from './reservation.orm-entity';

export const ReservationMapper = {
  toDomain(row: ReservationOrmEntity): Reservation {
    return Reservation.fromPersistence({
      id: row.id,
      userId: row.userId,
      contact:
        row.customerName || row.customerPhone
          ? {
              name: row.customerName ?? '',
              phone: row.customerPhone ?? '',
              email: row.customerEmail,
            }
          : null,
      scheduledAt: row.scheduledAt,
      endedAt: row.endedAt,
      workerId: row.workerId,
      status: row.status as ReservationStatus,
      lines: (row.services ?? []).map((s) => ({
        serviceId: s.serviceId,
        name: s.name,
        price: Number(s.price),
        durationMinutes: s.durationMinutes,
      })),
    });
  },

  /**
   * Columnas escalares del agregado (sin la relación `services`). Es lo único
   * mutable tras la creación (el ciclo de vida solo cambia `status`); la ruta de
   * actualización del repositorio persiste solo esto para no reescribir las
   * líneas de servicio inmutables.
   */
  toOrmScalars(reservation: Reservation): DeepPartial<ReservationOrmEntity> {
    return {
      scheduledAt: reservation.scheduledAt,
      endedAt: reservation.endedAt,
      workerId: reservation.workerId,
      totalDurationMinutes: reservation.totalDurationMinutes,
      status: reservation.status,
      userId: reservation.userId,
      customerName: reservation.contact?.name ?? null,
      customerPhone: reservation.contact?.phone ?? null,
      customerEmail: reservation.contact?.email ?? null,
    };
  },

  // `DeepPartial` permite entregar líneas como objetos planos; `repo.create` las
  // materializa como entidades y la cascada (`cascade: true`) las persiste. Solo
  // se usa al INSERTAR: en una actualización, reescribir las líneas sin id las
  // reinsertaría (no hay `orphanedRowAction`).
  toOrm(reservation: Reservation): DeepPartial<ReservationOrmEntity> {
    return {
      ...(reservation.id ? { id: reservation.id } : {}),
      ...this.toOrmScalars(reservation),
      services: reservation.lines.map((l) => ({
        serviceId: l.serviceId,
        name: l.name,
        price: l.price,
        durationMinutes: l.durationMinutes,
      })),
    };
  },
};

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

  // `DeepPartial` permite entregar líneas como objetos planos; `repo.create` las
  // materializa como entidades y la cascada (`cascade: true`) las persiste.
  toOrm(reservation: Reservation): DeepPartial<ReservationOrmEntity> {
    return {
      ...(reservation.id ? { id: reservation.id } : {}),
      scheduledAt: reservation.scheduledAt,
      endedAt: reservation.endedAt,
      workerId: reservation.workerId,
      totalDurationMinutes: reservation.totalDurationMinutes,
      status: reservation.status,
      userId: reservation.userId,
      customerName: reservation.contact?.name ?? null,
      customerPhone: reservation.contact?.phone ?? null,
      customerEmail: reservation.contact?.email ?? null,
      services: reservation.lines.map((l) => ({
        serviceId: l.serviceId,
        name: l.name,
        price: l.price,
        durationMinutes: l.durationMinutes,
      })),
    };
  },
};

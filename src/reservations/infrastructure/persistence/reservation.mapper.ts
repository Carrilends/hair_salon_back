import { Reservation } from '../../domain/reservation';
import { ReservationOrmEntity } from './reservation.orm-entity';

export const ReservationMapper = {
  toDomain(row: ReservationOrmEntity): Reservation {
    return Reservation.fromPersistence({
      id: row.id,
      scheduledAt: row.scheduledAt,
      endedAt: row.endedAt,
      workerId: row.workerId,
      totalDurationMinutes: row.totalDurationMinutes,
    });
  },
  toOrm(reservation: Reservation): Partial<ReservationOrmEntity> {
    return {
      ...(reservation.id ? { id: reservation.id } : {}),
      scheduledAt: reservation.scheduledAt,
      endedAt: reservation.endedAt,
      workerId: reservation.workerId,
      totalDurationMinutes: reservation.totalDurationMinutes,
    };
  },
};

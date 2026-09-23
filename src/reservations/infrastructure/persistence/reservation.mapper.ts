import { DeepPartial } from 'typeorm';
import { Reservation } from '../../domain/reservation';
import { ReservationStatus } from '../../domain/reservation-status';
import { ReservationOrmEntity } from './reservation.orm-entity';
import { normalizeCoPhoneToE164 } from 'src/common/phone';

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
      workerPinned: row.workerPinned,
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
   * Columnas escalares del agregado (sin la relación `services`). Tras la
   * creación cambian `status` y, desde la reprogramación, también la ventana
   * (`scheduled_at` / `ended_at`); la ruta de actualización del repositorio
   * persiste solo esto para no reescribir las líneas de servicio inmutables.
   *
   * Aquí se calcula la columna derivada `customerPhoneE164`. Se hace en el
   * mapper —y no con una columna generada en SQL— porque la regla de
   * normalización vive en `src/common/phone.ts` y reimplementarla en SQL
   * dejaría dos versiones que se desincronizan. Como `toOrmScalars` corre tanto
   * al crear como al actualizar, la columna se mantiene sola.
   */
  toOrmScalars(reservation: Reservation): DeepPartial<ReservationOrmEntity> {
    const phone = reservation.contact?.phone ?? null;
    return {
      scheduledAt: reservation.scheduledAt,
      endedAt: reservation.endedAt,
      workerId: reservation.workerId,
      // Viaja en la ruta de actualización igual que `workerId`: la
      // reprogramación puede cambiar la estilista, pero nunca la marca.
      workerPinned: reservation.workerPinned,
      totalDurationMinutes: reservation.totalDurationMinutes,
      status: reservation.status,
      userId: reservation.userId,
      customerName: reservation.contact?.name ?? null,
      customerPhone: phone,
      customerPhoneE164: normalizeCoPhoneToE164(phone),
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

import { Reservation } from './reservation';
import { OutOfBusinessHoursError } from './errors';
import { getDatePartsInTz, getDayBounds } from '../salon-time';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export class ReservationScheduling {
  /** Regla pura: la ventana [scheduledAt, endedAt) debe caber en el horario del día. */
  assertWithinBusinessHours(reservation: Reservation, tz: string): void {
    const parts = getDatePartsInTz(reservation.scheduledAt, tz);
    const ymd = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
    const bounds = getDayBounds(ymd, tz);
    const startMin = parts.hour * 60 + parts.minute;
    const endMin = startMin + reservation.totalDurationMinutes;
    // `closeMin` es la hora de cierre: la reserva puede terminar justo en ella,
    // no después. (Misma convención que el front: `end <= closeMin`.)
    if (startMin < bounds.openMin || endMin > bounds.closeMin) {
      throw new OutOfBusinessHoursError();
    }
  }
}

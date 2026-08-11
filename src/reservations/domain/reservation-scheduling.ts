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
    if (startMin < bounds.openMin || endMin - 1 > bounds.closeMin) {
      throw new OutOfBusinessHoursError();
    }
  }
}

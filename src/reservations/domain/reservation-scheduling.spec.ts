import { Reservation } from './reservation';
import { ReservationScheduling } from './reservation-scheduling';
import { OutOfBusinessHoursError } from './errors';

// Horario del salón (America/Bogota, UTC-5):
//   Lun–Vie 08:00–21:59 · Sáb/Dom 09:00–19:59
// La regla replica la del servicio actual: [start, end) debe caber en el día.
describe('ReservationScheduling.assertWithinBusinessHours', () => {
  const tz = 'America/Bogota';
  const scheduling = new ReservationScheduling();

  const at = (isoUtc: string, minutes: number) =>
    Reservation.schedule({
      scheduledAt: new Date(isoUtc),
      totalDurationMinutes: minutes,
      workerId: 'w-1',
    });

  it('acepta una reserva dentro del horario (lun 10:00 Bogotá)', () => {
    const r = at('2026-04-20T15:00:00.000Z', 60); // lun 10:00
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).not.toThrow();
  });

  it('rechaza una reserva fuera del horario (lun 22:00 Bogotá)', () => {
    const r = at('2026-04-21T03:00:00.000Z', 30); // lun 22:00
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).toThrow(
      OutOfBusinessHoursError,
    );
  });

  it('acepta justo en la apertura de un día laborable (lun 08:00)', () => {
    const r = at('2026-04-20T13:00:00.000Z', 60); // lun 08:00–09:00
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).not.toThrow();
  });

  it('rechaza cuando el fin excede el cierre laborable (lun 21:30 + 60min)', () => {
    const r = at('2026-04-21T02:30:00.000Z', 60); // lun 21:30–22:30, cierra 21:59
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).toThrow(
      OutOfBusinessHoursError,
    );
  });

  it('acepta justo en la apertura del fin de semana (sáb 09:00)', () => {
    const r = at('2026-04-18T14:00:00.000Z', 60); // sáb 09:00–10:00
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).not.toThrow();
  });

  it('rechaza antes de la apertura del fin de semana (sáb 08:30)', () => {
    const r = at('2026-04-18T13:30:00.000Z', 30); // sáb 08:30, abre 09:00
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).toThrow(
      OutOfBusinessHoursError,
    );
  });
});

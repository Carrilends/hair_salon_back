import { Reservation } from './reservation';
import { ReservationScheduling } from './reservation-scheduling';
import { OutOfBusinessHoursError } from './errors';

// Horario del salón (America/Bogota, UTC-5):
//   Lun–Vie 08:00–20:00 · Sáb/Dom/festivos 09:00–19:00
// La reserva [start, end) debe caber en el día: end no puede pasar del cierre.
describe('ReservationScheduling.assertWithinBusinessHours', () => {
  const tz = 'America/Bogota';
  const scheduling = new ReservationScheduling();

  const at = (isoUtc: string, minutes: number) =>
    Reservation.schedule({
      scheduledAt: new Date(isoUtc),
      workerId: 'w-1',
      userId: 'w-1',
      lines: [
        {
          serviceId: 's',
          name: 'Servicio',
          price: 0,
          durationMinutes: minutes,
        },
      ],
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

  it('rechaza cuando el fin excede el cierre laborable (lun 20:00 + 60min → 21:00)', () => {
    const r = at('2026-04-21T01:00:00.000Z', 60); // lun 20:00–21:00, cierra 20:00
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).toThrow(
      OutOfBusinessHoursError,
    );
  });

  it('acepta cuando el fin coincide justo con el cierre laborable (lun 19:00 + 60min → 20:00)', () => {
    const r = at('2026-04-21T00:00:00.000Z', 60); // lun 19:00–20:00
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).not.toThrow();
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

  it('rechaza cuando el fin excede el cierre del fin de semana (sáb 18:30 + 60min → 19:30)', () => {
    const r = at('2026-04-18T23:30:00.000Z', 60); // sáb 18:30–19:30, cierra 19:00
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).toThrow(
      OutOfBusinessHoursError,
    );
  });

  it('acepta cuando el fin coincide justo con el cierre del fin de semana (sáb 18:00 + 60min → 19:00)', () => {
    const r = at('2026-04-18T23:00:00.000Z', 60); // sáb 18:00–19:00
    expect(() => scheduling.assertWithinBusinessHours(r, tz)).not.toThrow();
  });
});

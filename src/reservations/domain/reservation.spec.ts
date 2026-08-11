import { Reservation } from './reservation';
import { InvalidReservationError } from './errors';

describe('Reservation (entidad de dominio pura)', () => {
  const validInput = {
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    totalDurationMinutes: 60,
    workerId: 'w-1',
  };

  describe('schedule', () => {
    it('calcula endedAt sumando la duración a scheduledAt', () => {
      const r = Reservation.schedule(validInput);

      expect(r.endedAt.toISOString()).toBe('2026-04-20T16:00:00.000Z');
      expect(r.scheduledAt).toBe(validInput.scheduledAt);
      expect(r.workerId).toBe('w-1');
      expect(r.totalDurationMinutes).toBe(60);
      expect(r.id).toBeUndefined();
    });

    it('rechaza scheduledAt inválido (fecha no parseable)', () => {
      expect(() =>
        Reservation.schedule({ ...validInput, scheduledAt: new Date('nope') }),
      ).toThrow(InvalidReservationError);
    });

    it('rechaza una duración que no es entero positivo', () => {
      expect(() =>
        Reservation.schedule({ ...validInput, totalDurationMinutes: 0 }),
      ).toThrow(InvalidReservationError);
      expect(() =>
        Reservation.schedule({ ...validInput, totalDurationMinutes: 30.5 }),
      ).toThrow(InvalidReservationError);
    });
  });

  describe('fromPersistence', () => {
    it('rehidrata todos los campos, incluido el id', () => {
      const props = {
        id: 'res-1',
        scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
        endedAt: new Date('2026-04-20T16:00:00.000Z'),
        workerId: 'w-1',
        totalDurationMinutes: 60,
      };

      const r = Reservation.fromPersistence(props);

      expect(r).toMatchObject(props);
    });
  });
});

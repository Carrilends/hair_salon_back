import { Reservation } from './reservation';
import { ReservationStatus } from './reservation-status';
import {
  EmptyServicesError,
  MissingContactError,
  CancellationTooLateError,
  InvalidReservationError,
  InvalidStatusTransitionError,
} from './errors';

const lines = [
  { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
  { serviceId: 's2', name: 'Barba', price: 15000, durationMinutes: 15 },
];

function make(userId: string): Reservation {
  return Reservation.schedule({
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    workerId: 'w-1',
    userId,
    lines,
  });
}

describe('Reservation (agregado maduro)', () => {
  it('deriva la duración total de las líneas y nace pendiente', () => {
    const r = Reservation.schedule({
      scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
      workerId: 'w-1',
      userId: 'u-1',
      lines,
    });
    expect(r.totalDurationMinutes).toBe(45);
    expect(r.status).toBe(ReservationStatus.Pendiente);
    expect(r.endedAt.getTime() - r.scheduledAt.getTime()).toBe(45 * 60 * 1000);
  });

  it('rechaza una fecha inválida', () => {
    expect(() =>
      Reservation.schedule({
        scheduledAt: new Date('no-es-fecha'),
        workerId: 'w-1',
        userId: 'u-1',
        lines,
      }),
    ).toThrow(InvalidReservationError);
  });

  it('exige al menos un servicio', () => {
    expect(() =>
      Reservation.schedule({
        scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
        workerId: 'w-1',
        userId: 'u-1',
        lines: [],
      }),
    ).toThrow(EmptyServicesError);
  });

  it('exige contacto cuando no hay usuario', () => {
    expect(() =>
      Reservation.schedule({
        scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
        workerId: 'w-1',
        lines,
      }),
    ).toThrow(MissingContactError);
  });

  it('acepta una reserva anónima con datos de contacto', () => {
    const r = Reservation.schedule({
      scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
      workerId: 'w-1',
      lines,
      contact: { name: 'Ana', phone: '3001234567' },
    });
    expect(r.userId).toBeNull();
    expect(r.contact?.name).toBe('Ana');
  });

  it('confirma una reserva pendiente', () => {
    const r = make('u-1');
    r.confirm();
    expect(r.status).toBe(ReservationStatus.Confirmada);
  });

  it('marca cumplida una reserva confirmada', () => {
    const r = make('u-1');
    r.confirm();
    r.markFulfilled();
    expect(r.status).toBe(ReservationStatus.Cumplida);
  });

  it('rechaza cumplir una reserva aún pendiente', () => {
    const r = make('u-1');
    expect(() => r.markFulfilled()).toThrow(InvalidStatusTransitionError);
  });

  it('permite al cliente cancelar antes de la hora', () => {
    const r = make('u-1');
    r.cancel({ byAdmin: false, now: new Date('2026-04-20T14:00:00.000Z') });
    expect(r.status).toBe(ReservationStatus.Cancelada);
  });

  it('impide al cliente cancelar una vez pasada la hora', () => {
    const r = make('u-1');
    expect(() =>
      r.cancel({ byAdmin: false, now: new Date('2026-04-20T16:00:00.000Z') }),
    ).toThrow(CancellationTooLateError);
  });

  it('permite a administración cancelar aunque haya pasado la hora', () => {
    const r = make('u-1');
    r.cancel({ byAdmin: true, now: new Date('2026-04-20T16:00:00.000Z') });
    expect(r.status).toBe(ReservationStatus.Cancelada);
  });

  it('se serializa exponiendo status y totalDurationMinutes (no el campo interno _status)', () => {
    const json = JSON.parse(JSON.stringify(make('u-1')));
    expect(json.status).toBe('pendiente');
    expect(json.totalDurationMinutes).toBe(45);
    expect(json).not.toHaveProperty('_status');
  });

  it('rehidrata desde persistencia conservando estado y líneas', () => {
    const r = Reservation.fromPersistence({
      id: 'r-1',
      userId: 'u-1',
      contact: null,
      scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
      endedAt: new Date('2026-04-20T15:45:00.000Z'),
      workerId: 'w-1',
      status: ReservationStatus.Confirmada,
      lines,
    });
    expect(r.id).toBe('r-1');
    expect(r.status).toBe(ReservationStatus.Confirmada);
    expect(r.totalDurationMinutes).toBe(45);
  });
});

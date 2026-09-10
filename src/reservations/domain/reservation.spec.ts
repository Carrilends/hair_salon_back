import { Reservation } from './reservation';
import { ReservationStatus } from './reservation-status';
import {
  EmptyServicesError,
  MissingContactError,
  CancellationTooLateError,
  InvalidReservationError,
  InvalidStatusTransitionError,
  RescheduleTooLateError,
  ReservationNotReschedulableError,
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

describe('Reservation.reschedule', () => {
  const lines = [
    { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 45 },
  ];

  function pendiente(): Reservation {
    return Reservation.schedule({
      scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
      workerId: 'w-1',
      userId: 'u-1',
      lines,
    });
  }

  function enEstado(status: ReservationStatus): Reservation {
    return Reservation.fromPersistence({
      id: 'r-1',
      userId: 'u-1',
      contact: null,
      scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
      endedAt: new Date('2026-04-20T15:45:00.000Z'),
      workerId: 'w-1',
      status,
      lines,
    });
  }

  const antesDeLaCita = new Date('2026-04-20T14:00:00.000Z');

  it('mueve la ventana y recalcula el fin desde la duración total', () => {
    const r = pendiente();

    r.reschedule({
      scheduledAt: new Date('2026-04-21T10:00:00.000Z'),
      now: antesDeLaCita,
      byAdmin: false,
    });

    expect(r.scheduledAt).toEqual(new Date('2026-04-21T10:00:00.000Z'));
    expect(r.endedAt).toEqual(new Date('2026-04-21T10:45:00.000Z'));
  });

  it('CONSERVA el estado: una confirmada sigue confirmada', () => {
    // Degradarla a `pendiente` la expondría al cron de saldado, que cancela las
    // pendientes vencidas: una clienta que movió su cita y sí asistió quedaría
    // registrada como cancelada. El control de la peluquería sobre la hora nueva
    // se resuelve avisándole, no corrompiendo el histórico.
    const r = enEstado(ReservationStatus.Confirmada);

    r.reschedule({
      scheduledAt: new Date('2026-04-21T10:00:00.000Z'),
      now: antesDeLaCita,
      byAdmin: false,
    });

    expect(r.status).toBe(ReservationStatus.Confirmada);
  });

  it('rechaza una fecha inválida', () => {
    const r = pendiente();
    expect(() =>
      r.reschedule({
        scheduledAt: new Date('no-es-fecha'),
        now: antesDeLaCita,
        byAdmin: false,
      }),
    ).toThrow(InvalidReservationError);
  });

  it.each([ReservationStatus.Cumplida, ReservationStatus.Cancelada])(
    'no se puede mover una reserva %s',
    (status) => {
      const r = enEstado(status);
      expect(() =>
        r.reschedule({
          scheduledAt: new Date('2026-04-21T10:00:00.000Z'),
          now: antesDeLaCita,
          byAdmin: false,
        }),
      ).toThrow(ReservationNotReschedulableError);
    },
  );

  it('la clienta NO puede mover una cita cuya hora ya pasó', () => {
    // Paridad exacta con cancelar: la referencia es la hora ACTUAL de la cita,
    // no la nueva.
    const r = pendiente();
    expect(() =>
      r.reschedule({
        scheduledAt: new Date('2026-04-21T10:00:00.000Z'),
        now: new Date('2026-04-20T16:00:00.000Z'),
        byAdmin: false,
      }),
    ).toThrow(RescheduleTooLateError);
  });

  it('administración sí puede moverla pasada la hora', () => {
    const r = pendiente();
    r.reschedule({
      scheduledAt: new Date('2026-04-21T10:00:00.000Z'),
      now: new Date('2026-04-20T16:00:00.000Z'),
      byAdmin: true,
    });
    expect(r.scheduledAt).toEqual(new Date('2026-04-21T10:00:00.000Z'));
  });

  it('respeta el margen de antelación configurado', () => {
    // Con `minLeadMinutes` a 0 se comporta igual que hoy; subirlo es una decisión
    // de negocio que no toca código.
    const r = pendiente();
    expect(() =>
      r.reschedule({
        scheduledAt: new Date('2026-04-21T10:00:00.000Z'),
        now: new Date('2026-04-20T13:30:00.000Z'), // 90 min antes
        byAdmin: false,
        minLeadMinutes: 120,
      }),
    ).toThrow(RescheduleTooLateError);
  });

  it('el margen de antelación no aplica a administración', () => {
    const r = pendiente();
    r.reschedule({
      scheduledAt: new Date('2026-04-21T10:00:00.000Z'),
      now: new Date('2026-04-20T14:59:00.000Z'),
      byAdmin: true,
      minLeadMinutes: 120,
    });
    expect(r.scheduledAt).toEqual(new Date('2026-04-21T10:00:00.000Z'));
  });

  it('mover a la misma hora es idempotente y no rompe nada', () => {
    // Importa porque el canal de WhatsApp puede reenviar la misma pulsación.
    const r = pendiente();
    const antes = r.scheduledAt;

    r.reschedule({
      scheduledAt: new Date(antes),
      now: antesDeLaCita,
      byAdmin: false,
    });

    expect(r.scheduledAt).toEqual(antes);
    expect(r.endedAt).toEqual(new Date('2026-04-20T15:45:00.000Z'));
  });
});

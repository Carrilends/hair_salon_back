import { NotificationDispatcher } from './notification-dispatcher';
import {
  NotifiableEvent,
  ReservationCreatedEvent,
} from '../domain/events/notifiable-event';

const event = {
  type: 'reservation.created',
  reservationId: 'r-1',
  scheduledAt: new Date('2026-08-05T15:00:00.000Z'),
  endedAt: new Date('2026-08-05T16:00:00.000Z'),
  workerName: 'Marlene',
  customerName: 'Ana',
  customerPhone: '3001234567',
  services: [{ name: 'Corte', price: 20000, durationMinutes: 60 }],
  totalDurationMinutes: 60,
  totalPrice: 20000,
  status: 'pendiente',
} as ReservationCreatedEvent;

describe('NotificationDispatcher', () => {
  it('entrega el evento a todos los canales', async () => {
    const entregas: string[] = [];
    const dispatcher = new NotificationDispatcher([
      {
        channel: 'correo',
        notify: async () => {
          entregas.push('correo');
        },
      },
      {
        channel: 'websocket',
        notify: async () => {
          entregas.push('websocket');
        },
      },
    ]);
    await dispatcher.notify(event);
    expect(entregas).toEqual(['correo', 'websocket']);
  });

  it('si un canal falla, los demás siguen entregando y no se propaga el error', async () => {
    const entregas: string[] = [];
    const dispatcher = new NotificationDispatcher([
      {
        channel: 'correo',
        notify: async () => {
          throw new Error('proveedor caído');
        },
      },
      {
        channel: 'websocket',
        notify: async () => {
          entregas.push('websocket');
        },
      },
    ]);
    await expect(dispatcher.notify(event)).resolves.toBeUndefined();
    expect(entregas).toEqual(['websocket']);
  });

  it('sin canales registrados no falla', async () => {
    await expect(
      new NotificationDispatcher([]).notify(event),
    ).resolves.toBeUndefined();
  });
});

describe('NotificationDispatcher · unión de eventos', () => {
  it.each([
    'reservation.created',
    'reservation.cancelled',
    'reservation.rescheduled',
  ] as const)('entrega el evento %s a todos los canales', async (type) => {
    const recibidos: string[] = [];
    const canal = {
      channel: 'x',
      notify: async (e: NotifiableEvent) => {
        recibidos.push(e.type);
      },
    };
    const sut = new NotificationDispatcher([canal] as any);

    await sut.notify({ ...eventoBase(), type } as NotifiableEvent);

    expect(recibidos).toEqual([type]);
  });

  it('registra el fallo con el tipo y el id de CUALQUIER miembro de la unión', async () => {
    // `reservationId` vive en la base justamente para que este registro siga
    // compilando y siendo útil al ampliar la unión.
    const errores: string[] = [];
    const logger = { error: (msg: string) => errores.push(msg) };
    const roto = {
      channel: 'roto',
      notify: async () => {
        throw new Error('caído');
      },
    };
    const sut = new NotificationDispatcher([roto] as any);
    (sut as any).logger = logger;

    await sut.notify({
      ...eventoBase(),
      type: 'reservation.cancelled',
      byAdmin: true,
    } as NotifiableEvent);

    expect(errores[0]).toContain('reservation.cancelled');
    expect(errores[0]).toContain('r-1');
  });
});

function eventoBase() {
  return {
    reservationId: 'r-1',
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    endedAt: new Date('2026-04-20T16:00:00.000Z'),
    workerName: 'Marlene',
    customerName: 'Ana',
    customerPhone: '3001234567',
    services: [{ name: 'Corte', price: 20000, durationMinutes: 60 }],
    totalDurationMinutes: 60,
    totalPrice: 20000,
    status: 'pendiente',
  };
}

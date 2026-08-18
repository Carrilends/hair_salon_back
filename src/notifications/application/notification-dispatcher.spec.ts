import { NotificationDispatcher } from './notification-dispatcher';
import { ReservationCreatedEvent } from '../domain/events/reservation-created.event';

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

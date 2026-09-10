import { WebSocketNotifier } from './websocket-notifier.adapter';
import { ADMIN_ROOM } from './admin-events.gateway';
import { NotifiableEvent } from '../../domain/events/notifiable-event';

const event = {
  type: 'reservation.created',
  reservationId: 'r-1',
  scheduledAt: new Date('2026-08-05T20:00:00.000Z'),
  endedAt: new Date('2026-08-05T21:00:00.000Z'),
  workerName: 'Marlene',
  customerName: 'Ana',
  customerPhone: '3001234567',
  services: [{ name: 'Corte', price: 20000, durationMinutes: 60 }],
  totalDurationMinutes: 60,
  totalPrice: 20000,
  status: 'pendiente',
} as NotifiableEvent;

describe('WebSocketNotifier', () => {
  it('emite el evento a la sala de administración', async () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    const gateway = { server: { to } };
    const notifier = new WebSocketNotifier(gateway as any);

    await notifier.notify(event);

    expect(to).toHaveBeenCalledWith(ADMIN_ROOM);
    expect(emit).toHaveBeenCalledWith('reservation.created', event);
  });

  it('no falla si el servidor aún no está inicializado', async () => {
    const notifier = new WebSocketNotifier({ server: undefined } as any);
    await expect(notifier.notify(event)).resolves.toBeUndefined();
  });
});

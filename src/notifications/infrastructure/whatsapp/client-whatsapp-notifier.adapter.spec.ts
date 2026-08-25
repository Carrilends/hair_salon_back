import { ReservationCreatedEvent } from '../../domain/events/reservation-created.event';
import { WhatsAppMessage } from '../../domain/ports/whatsapp-sender.port';
import {
  ClientWhatsAppConfig,
  ClientWhatsAppNotifier,
} from './client-whatsapp-notifier.adapter';

const config: ClientWhatsAppConfig = { timeZone: 'America/Bogota' };

function makeEvent(
  overrides: Partial<ReservationCreatedEvent> = {},
): ReservationCreatedEvent {
  return {
    type: 'reservation.created',
    reservationId: 'r-1',
    // 20:00 UTC → 15:00 (3:00 p. m.) en Bogotá (UTC-5).
    scheduledAt: new Date('2026-08-29T20:00:00Z'),
    endedAt: new Date('2026-08-29T21:00:00Z'),
    workerName: 'Ana',
    customerName: 'Marta',
    customerPhone: '3001234567',
    services: [
      { name: 'Corte', price: 30000, durationMinutes: 30 },
      { name: 'Tinte', price: 80000, durationMinutes: 60 },
    ],
    totalDurationMinutes: 90,
    totalPrice: 110000,
    status: 'pending',
    ...overrides,
  };
}

function makeNotifier() {
  const sent: WhatsAppMessage[] = [];
  const sender = {
    send: async (m: WhatsAppMessage) => {
      sent.push(m);
    },
  };
  const notifier = new ClientWhatsAppNotifier(sender as never, config);
  return { notifier, sent };
}

describe('ClientWhatsAppNotifier', () => {
  it('anuncia el canal whatsapp', () => {
    const { notifier } = makeNotifier();
    expect(notifier.channel).toBe('whatsapp');
  });

  it('envía con el teléfono normalizado a E.164 y los parámetros de plantilla', async () => {
    const { notifier, sent } = makeNotifier();

    await notifier.notify(makeEvent());

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('573001234567');
    // [fecha en zona del salón, estilista, servicios]
    expect(sent[0].bodyParams).toHaveLength(3);
    expect(sent[0].bodyParams[1]).toBe('Ana');
    expect(sent[0].bodyParams[2]).toBe('Corte, Tinte');
  });

  it('formatea la fecha en la zona del salón, no en la del servidor', async () => {
    const { notifier, sent } = makeNotifier();

    await notifier.notify(makeEvent());

    expect(sent[0].bodyParams[0]).toContain('3:00');
    expect(sent[0].bodyParams[0]).not.toContain('8:00');
  });

  it('se salta el envío sin lanzar cuando no hay teléfono', async () => {
    const { notifier, sent } = makeNotifier();

    await expect(
      notifier.notify(makeEvent({ customerPhone: null })),
    ).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it('se salta el envío sin lanzar cuando el teléfono no es un móvil válido', async () => {
    const { notifier, sent } = makeNotifier();

    await expect(
      notifier.notify(makeEvent({ customerPhone: '12345' })),
    ).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it('propaga el error del transporte para que el despachador lo aísle (NF11)', async () => {
    const sender = {
      send: async () => {
        throw new Error('cloud api 401');
      },
    };
    const notifier = new ClientWhatsAppNotifier(sender as never, config);

    // A diferencia del teléfono inválido (que se salta sin lanzar), un fallo de
    // red debe subir: el despachador lo aísla con Promise.allSettled.
    await expect(notifier.notify(makeEvent())).rejects.toThrow(/401/);
  });
});

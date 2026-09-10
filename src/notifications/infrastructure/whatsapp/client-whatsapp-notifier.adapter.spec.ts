import { ReservationCreatedEvent } from '../../domain/events/notifiable-event';
import { WhatsAppMessage } from '../../domain/ports/whatsapp-sender.port';
import {
  ClientWhatsAppConfig,
  ClientWhatsAppNotifier,
} from './client-whatsapp-notifier.adapter';

const config: ClientWhatsAppConfig = {
  timeZone: 'America/Bogota',
  templateCreated: 'reserva_creada_cliente',
  templateCancelled: 'reserva_cancelada_cliente',
  templateRescheduled: 'reserva_reprogramada_cliente',
};

/** Estrecha la unión para poder leer los campos de plantilla en las aserciones. */
function comoPlantilla(m: WhatsAppMessage) {
  if (m.kind !== 'template')
    throw new Error(`se esperaba plantilla, no ${m.kind}`);
  return m;
}

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
    const p = comoPlantilla(sent[0]);
    expect(p.templateName).toBe('reserva_creada_cliente');
    expect(p.bodyParams).toHaveLength(3);
    expect(p.bodyParams[1]).toBe('Ana');
    expect(p.bodyParams[2]).toBe('Corte, Tinte');
  });

  it('formatea la fecha en la zona del salón, no en la del servidor', async () => {
    const { notifier, sent } = makeNotifier();

    await notifier.notify(makeEvent());

    expect(comoPlantilla(sent[0]).bodyParams[0]).toContain('3:00');
    expect(comoPlantilla(sent[0]).bodyParams[0]).not.toContain('8:00');
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

describe('ClientWhatsAppNotifier · discriminación por tipo de evento', () => {
  it('la confirmación lleva los dos botones con el id de la reserva', async () => {
    const { notifier, sent } = makeNotifier();

    await notifier.notify(makeEvent());

    expect(comoPlantilla(sent[0]).buttons).toEqual([
      { index: 0, payload: 'CANCEL|r-1' },
      { index: 1, payload: 'RESCHED|r-1' },
    ]);
  });

  it('NO le cuenta a la clienta una cancelación que hizo ella misma', async () => {
    // Ya se la confirmó el canal por el que la hizo. Recibir además un WhatsApp
    // diciéndole lo que acaba de hacer es ruido, y encima se cobra.
    const { notifier, sent } = makeNotifier();

    await notifier.notify({
      ...makeEvent(),
      type: 'reservation.cancelled',
      byAdmin: false,
    } as never);

    expect(sent).toHaveLength(0);
  });

  it('SÍ le cuenta una cancelación hecha por la peluquería', async () => {
    const { notifier, sent } = makeNotifier();

    await notifier.notify({
      ...makeEvent(),
      type: 'reservation.cancelled',
      byAdmin: true,
    } as never);

    expect(sent).toHaveLength(1);
    expect(comoPlantilla(sent[0]).templateName).toBe(
      'reserva_cancelada_cliente',
    );
  });

  it('SÍ le cuenta un cambio de hora hecho por la peluquería, con antes y después', async () => {
    const { notifier, sent } = makeNotifier();

    await notifier.notify({
      ...makeEvent(),
      type: 'reservation.rescheduled',
      byAdmin: true,
      previousScheduledAt: new Date('2026-08-27T20:00:00Z'),
    } as never);

    const p = comoPlantilla(sent[0]);
    expect(p.templateName).toBe('reserva_reprogramada_cliente');
    expect(p.bodyParams).toHaveLength(3);
    expect(p.bodyParams[0]).toContain('27 de agosto');
    expect(p.bodyParams[1]).toContain('29 de agosto');
    expect(p.bodyParams[2]).toBe('Ana');
  });

  it('NO le cuenta un cambio de hora que hizo ella misma', async () => {
    const { notifier, sent } = makeNotifier();

    await notifier.notify({
      ...makeEvent(),
      type: 'reservation.rescheduled',
      byAdmin: false,
      previousScheduledAt: new Date('2026-08-27T20:00:00Z'),
    } as never);

    expect(sent).toHaveLength(0);
  });
});

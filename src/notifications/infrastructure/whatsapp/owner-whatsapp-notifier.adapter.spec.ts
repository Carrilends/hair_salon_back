import { NotifiableEvent } from '../../domain/events/notifiable-event';
import { WhatsAppMessage } from '../../domain/ports/whatsapp-sender.port';
import {
  OwnerWhatsAppConfig,
  OwnerWhatsAppNotifier,
} from './owner-whatsapp-notifier.adapter';

const config: OwnerWhatsAppConfig = {
  ownerPhone: '3208977471',
  timeZone: 'America/Bogota',
  templateName: 'aviso_duena',
};

function evento(overrides: Record<string, unknown> = {}): NotifiableEvent {
  return {
    type: 'reservation.created',
    reservationId: '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60',
    // 20:00 UTC → 3:00 p. m. en Bogotá.
    scheduledAt: new Date('2026-08-29T20:00:00Z'),
    endedAt: new Date('2026-08-29T21:00:00Z'),
    workerName: 'Ana',
    customerName: 'Marta',
    customerPhone: '3001234567',
    services: [{ name: 'Corte', price: 30000, durationMinutes: 60 }],
    totalDurationMinutes: 60,
    totalPrice: 30000,
    status: 'pendiente',
    ...overrides,
  } as NotifiableEvent;
}

function notificador(overrides: Partial<OwnerWhatsAppConfig> = {}) {
  const sent: WhatsAppMessage[] = [];
  const sender = {
    send: async (m: WhatsAppMessage) => {
      sent.push(m);
    },
  };
  const notifier = new OwnerWhatsAppNotifier(sender as never, {
    ...config,
    ...overrides,
  });
  return { notifier, sent };
}

function comoPlantilla(m: WhatsAppMessage) {
  if (m.kind !== 'template')
    throw new Error(`se esperaba plantilla: ${m.kind}`);
  return m;
}

describe('OwnerWhatsAppNotifier', () => {
  it('se anuncia como un canal propio, distinto del de la clienta', () => {
    const { notifier } = notificador();
    expect(notifier.channel).toBe('whatsapp-dueña');
  });

  it('envía al móvil de la peluquería, normalizado a E.164', async () => {
    const { notifier, sent } = notificador();

    await notifier.notify(evento());

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('573208977471');
  });

  it('se salta sin lanzar si no hay número configurado', async () => {
    // Es el estado normal antes de aprovisionar: no es un error.
    const { notifier, sent } = notificador({ ownerPhone: '' });

    await expect(notifier.notify(evento())).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it('se salta sin lanzar si no hay plantilla configurada', async () => {
    const { notifier, sent } = notificador({ templateName: '' });

    await expect(notifier.notify(evento())).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it('recibe los tres eventos, incluidos los que provoca la propia peluquería', async () => {
    // Su conversación es el registro de lo que pasa con la agenda; la clienta,
    // en cambio, solo recibe lo que decidió el salón.
    const { notifier, sent } = notificador();

    await notifier.notify(evento());
    await notifier.notify(
      evento({ type: 'reservation.cancelled', byAdmin: true }),
    );
    await notifier.notify(
      evento({
        type: 'reservation.rescheduled',
        byAdmin: true,
        previousScheduledAt: new Date('2026-08-27T20:00:00Z'),
      }),
    );

    expect(sent).toHaveLength(3);
  });

  it('el primer parámetro dice qué pasó y quién lo hizo', async () => {
    const { notifier, sent } = notificador();

    await notifier.notify(evento());
    await notifier.notify(
      evento({ type: 'reservation.cancelled', byAdmin: false }),
    );
    await notifier.notify(
      evento({ type: 'reservation.cancelled', byAdmin: true }),
    );

    expect(comoPlantilla(sent[0]).bodyParams[0]).toBe('Reserva nueva');
    expect(comoPlantilla(sent[1]).bodyParams[0]).toContain('la clienta');
    expect(comoPlantilla(sent[2]).bodyParams[0]).toContain('la peluquería');
  });

  it('una reprogramación menciona la hora anterior', async () => {
    const { notifier, sent } = notificador();

    await notifier.notify(
      evento({
        type: 'reservation.rescheduled',
        byAdmin: false,
        previousScheduledAt: new Date('2026-08-27T20:00:00Z'),
      }),
    );

    expect(comoPlantilla(sent[0]).bodyParams[0]).toContain('27 de agosto');
    expect(comoPlantilla(sent[0]).bodyParams[1]).toContain('29 de agosto');
  });

  it('el aviso de reserva nueva trae los tres botones de gestión', async () => {
    const { notifier, sent } = notificador();

    await notifier.notify(evento());

    expect(comoPlantilla(sent[0]).buttons).toEqual([
      { index: 0, payload: 'CONFIRM|4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60' },
      { index: 1, payload: 'CANCEL|4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60' },
      { index: 2, payload: 'RESCHED|4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60' },
    ]);
  });

  it('el aviso de una cita ya cancelada va SIN botones', async () => {
    // Una cancelada no admite nada más: unos botones que no llevan a ninguna
    // parte son peor que ninguno.
    const { notifier, sent } = notificador();

    await notifier.notify(
      evento({ type: 'reservation.cancelled', byAdmin: false }),
    );

    expect(comoPlantilla(sent[0]).buttons).toBeUndefined();
  });

  it('formatea las horas en la zona del salón, no en la del servidor', async () => {
    const { notifier, sent } = notificador();

    await notifier.notify(evento());

    expect(comoPlantilla(sent[0]).bodyParams[1]).toContain('3:00');
  });
});

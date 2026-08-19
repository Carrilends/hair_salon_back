import { OwnerEmailNotifier } from './owner-email-notifier.adapter';
import { EmailMessage } from '../../domain/ports/email-sender.port';
import { ReservationCreatedEvent } from '../../domain/events/reservation-created.event';

const event: ReservationCreatedEvent = {
  type: 'reservation.created',
  reservationId: 'r-1',
  // 20:00 UTC equivale a las 15:00 en Bogotá (UTC-5).
  scheduledAt: new Date('2026-08-05T20:00:00.000Z'),
  endedAt: new Date('2026-08-05T21:00:00.000Z'),
  workerName: 'Marlene',
  customerName: 'Ana',
  customerPhone: '3001234567',
  services: [
    { name: 'Corte', price: 20000, durationMinutes: 30 },
    { name: 'Peinado', price: 15000, durationMinutes: 30 },
  ],
  totalDurationMinutes: 60,
  totalPrice: 35000,
  status: 'pendiente',
};

const config = {
  to: 'peluqueria@example.com',
  timeZone: 'America/Bogota',
  panelUrl: 'https://sitio.netlify.app/reservas',
};

function makeAdapter() {
  const sent: EmailMessage[] = [];
  const mailer = {
    send: async (m: EmailMessage) => {
      sent.push(m);
    },
  };
  const adapter = new OwnerEmailNotifier(mailer as any, config);
  return { adapter, sent };
}

describe('OwnerEmailNotifier', () => {
  it('se identifica como el canal de correo', () => {
    const { adapter } = makeAdapter();
    expect(adapter.channel).toBe('correo');
  });

  it('formatea la hora en la zona del salón, no en la del servidor', async () => {
    const { adapter, sent } = makeAdapter();
    await adapter.notify(event);
    expect(sent).toHaveLength(1);
    // 15:00 Bogotá -> "3:00"; jamás la hora UTC "8:00".
    expect(sent[0].text).toContain('3:00');
    expect(sent[0].text).not.toContain('8:00');
  });

  it('incluye destinatario, estilista, todos los servicios y el enlace al panel', async () => {
    const { adapter, sent } = makeAdapter();
    await adapter.notify(event);
    const message = sent[0];
    expect(message.to).toBe('peluqueria@example.com');
    expect(message.text).toContain('Marlene');
    expect(message.text).toContain('Corte');
    expect(message.text).toContain('Peinado');
    expect(message.text).toContain('Ana');
    expect(message.text).toContain('https://sitio.netlify.app/reservas');
  });
});

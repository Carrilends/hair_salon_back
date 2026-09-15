import { OwnerEmailNotifier } from './owner-email-notifier.adapter';
import { EmailMessage } from '../../domain/ports/email-sender.port';
import { ReservationCreatedEvent } from '../../domain/events/notifiable-event';
import { SALON_NAME } from '../../application/branded-email';

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
  it('añade un cuerpo HTML con la marca, los servicios y el enlace al panel, sin perder el texto plano', async () => {
    const { adapter, sent } = makeAdapter();
    await adapter.notify(event);
    const message = sent[0];

    // La alternativa de texto no se degrada al añadir HTML.
    expect(message.text).toContain('Corte');
    expect(message.text).toContain('https://sitio.netlify.app/reservas');

    expect(message.html).toBeDefined();
    expect(message.html).toContain(SALON_NAME);
    expect(message.html).toContain('Corte');
    expect(message.html).toContain('Peinado');
    expect(message.html).toContain('https://sitio.netlify.app/reservas');
  });
});

describe('OwnerEmailNotifier · discriminación por tipo de evento', () => {
  it('anuncia una cancelación como cancelación, nunca como reserva nueva', async () => {
    // El despachador entrega TODOS los eventos a TODOS los canales. Sin
    // discriminar por tipo, este notificador leería los campos comunes y
    // anunciaría «Nueva reserva» ante una cancelación.
    const { mailer, enviados } = espia();
    const sut = notificador(mailer);

    await sut.notify({
      ...baseEvento(),
      type: 'reservation.cancelled',
      byAdmin: false,
    } as any);

    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toContain('cancel');
    expect(enviados[0].subject).not.toContain('Nueva reserva');
    // Quién canceló importa para la peluquería: no es lo mismo que la clienta
    // suelte la cita a que la haya soltado el propio salón.
    expect(enviados[0].text).toContain('la clienta');
  });

  it('distingue una cancelación hecha por la peluquería', async () => {
    const { mailer, enviados } = espia();
    const sut = notificador(mailer);

    await sut.notify({
      ...baseEvento(),
      type: 'reservation.cancelled',
      byAdmin: true,
    } as any);

    expect(enviados[0].text).toContain('la peluquería');
  });

  it('una reprogramación muestra antes y después', async () => {
    const { mailer, enviados } = espia();
    const sut = notificador(mailer);

    await sut.notify({
      ...baseEvento(),
      type: 'reservation.rescheduled',
      byAdmin: false,
      previousScheduledAt: new Date('2026-04-18T15:00:00.000Z'),
    } as any);

    expect(enviados[0].subject).toContain('cambi');
    // La hora nueva y la vieja, ambas, y en la zona del salón.
    expect(enviados[0].text).toContain('18 de abril');
    expect(enviados[0].text).toContain('20 de abril');
  });

  it('sigue avisando de las reservas nuevas', async () => {
    const { mailer, enviados } = espia();
    const sut = notificador(mailer);

    await sut.notify({ ...baseEvento(), type: 'reservation.created' } as any);

    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toContain('Nueva reserva');
  });

  it('anuncia una confirmación', async () => {
    const { mailer, enviados } = espia();
    const sut = notificador(mailer);

    await sut.notify({ ...baseEvento(), type: 'reservation.confirmed' } as any);

    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toContain('confirmada');
  });

  it('los cuatro avisos llevan el enlace al panel', async () => {
    const { mailer, enviados } = espia();
    const sut = notificador(mailer);

    for (const evento of [
      { type: 'reservation.created' },
      { type: 'reservation.cancelled', byAdmin: false },
      {
        type: 'reservation.rescheduled',
        byAdmin: false,
        previousScheduledAt: new Date('2026-04-18T15:00:00.000Z'),
      },
      { type: 'reservation.confirmed' },
    ]) {
      await sut.notify({ ...baseEvento(), ...evento } as any);
    }

    expect(enviados).toHaveLength(4);
    for (const m of enviados) {
      expect(m.text).toContain('https://panel');
      expect(m.html).toContain('https://panel');
    }
  });
});

function espia() {
  const enviados: any[] = [];
  const mailer = {
    send: async (m: unknown) => {
      enviados.push(m);
    },
  };
  return { mailer, enviados };
}

function notificador(mailer: unknown) {
  return new OwnerEmailNotifier(mailer as any, {
    to: 'salon@ejemplo.com',
    timeZone: 'America/Bogota',
    panelUrl: 'https://panel',
  });
}

function baseEvento() {
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

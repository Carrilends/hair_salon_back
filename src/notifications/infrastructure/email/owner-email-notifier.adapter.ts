import { Inject, Injectable } from '@nestjs/common';
import { NotifierPort } from '../../domain/ports/notifier.port';
import { EmailSenderPort } from '../../domain/ports/email-sender.port';
import { NotifiableEvent } from '../../domain/events/reservation-created.event';
import {
  EMAIL_SENDER,
  OWNER_NOTIFICATION_CONFIG,
} from '../../application/tokens';

export interface OwnerNotificationConfig {
  to: string;
  timeZone: string; // America/Bogota
  panelUrl: string; // enlace directo al panel de reservas
}

/**
 * Canal durable (N2): compone el aviso de reserva nueva y lo entrega al
 * `EmailSenderPort`; no sabe qué proveedor hay detrás. La hora se expresa en la
 * zona del salón, no en la del servidor (Railway corre en UTC), para no enviar
 * avisos con la hora corrida cinco horas.
 */
@Injectable()
export class OwnerEmailNotifier implements NotifierPort {
  readonly channel = 'correo';

  constructor(
    @Inject(EMAIL_SENDER) private readonly mailer: EmailSenderPort,
    @Inject(OWNER_NOTIFICATION_CONFIG)
    private readonly config: OwnerNotificationConfig,
  ) {}

  async notify(event: NotifiableEvent): Promise<void> {
    const cuando = new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: this.config.timeZone,
    }).format(event.scheduledAt);

    const servicios = event.services
      .map((s) => `  · ${s.name} (${s.durationMinutes} min)`)
      .join('\n');

    const telefono = event.customerPhone ? ` (${event.customerPhone})` : '';

    await this.mailer.send({
      to: this.config.to,
      subject: `Nueva reserva — ${cuando}`,
      text:
        'Se registró una reserva nueva en el portal.\n\n' +
        `Cuándo: ${cuando}\n` +
        `Estilista: ${event.workerName}\n` +
        `Cliente: ${event.customerName}${telefono}\n` +
        `Duración: ${event.totalDurationMinutes} minutos\n` +
        `Servicios:\n${servicios}\n\n` +
        `Estado: ${event.status}. Confírmala o cancélala en el panel:\n` +
        `${this.config.panelUrl}\n`,
    });
  }
}

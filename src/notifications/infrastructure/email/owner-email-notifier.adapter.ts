import { Inject, Injectable } from '@nestjs/common';
import { NotifierPort } from '../../domain/ports/notifier.port';
import { EmailSenderPort } from '../../domain/ports/email-sender.port';
import { NotifiableEvent } from '../../domain/events/notifiable-event';
import { renderBrandedEmail } from '../../application/branded-email';
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
 * Canal durable (N2): redacta el aviso que corresponda a cada evento de la
 * reserva —nueva, cancelada o movida de hora— y lo entrega al `EmailSenderPort`;
 * no sabe qué proveedor hay detrás. La hora se expresa siempre en la zona del
 * salón, no en la del servidor (Railway corre en UTC), para no enviar avisos con
 * la hora corrida cinco horas.
 *
 * La peluquería recibe **los tres**, incluidos los cambios que hace ella misma:
 * su bandeja es el registro de lo que pasa con la agenda.
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
    const cuando = this.formatear(event.scheduledAt);
    const serviciosEnLinea = event.services
      .map((s) => `${s.name} (${s.durationMinutes} min)`)
      .join(', ');
    const telefono = event.customerPhone ? ` (${event.customerPhone})` : '';
    const quien = `${event.customerName}${telefono}`;

    // Un `switch` exhaustivo sobre el discriminante: si mañana se añade un
    // evento a la unión, el compilador obliga a decidir qué se le cuenta a la
    // peluquería en vez de dejar que caiga en una rama que no le corresponde.
    const { subject, intro, extra } = this.redactar(event, cuando);

    const servicios = event.services
      .map((s) => `  · ${s.name} (${s.durationMinutes} min)`)
      .join('\n');

    await this.mailer.send({
      to: this.config.to,
      subject,
      text:
        `${intro}\n\n` +
        (extra ? `${extra}\n` : '') +
        `Cuándo: ${cuando}\n` +
        `Estilista: ${event.workerName}\n` +
        `Cliente: ${quien}\n` +
        `Duración: ${event.totalDurationMinutes} minutos\n` +
        `Servicios:\n${servicios}\n\n` +
        `Estado: ${event.status}. Gestiona la agenda en el panel:\n` +
        `${this.config.panelUrl}\n`,
      html: renderBrandedEmail({
        title: subject,
        paragraphs: [
          intro,
          ...(extra ? [extra] : []),
          `Cuándo: ${cuando}`,
          `Estilista: ${event.workerName}`,
          `Cliente: ${quien}`,
          `Duración: ${event.totalDurationMinutes} minutos`,
          // El HTML no respeta los saltos del texto plano: los servicios van en
          // una sola línea y la lista con saltos se reserva para la alternativa.
          `Servicios: ${serviciosEnLinea}`,
          `Estado: ${event.status}.`,
        ],
        action: {
          label: 'Abrir el panel de reservas',
          url: this.config.panelUrl,
        },
      }),
    });
  }

  private redactar(
    event: NotifiableEvent,
    cuando: string,
  ): { subject: string; intro: string; extra?: string } {
    switch (event.type) {
      case 'reservation.created':
        return {
          subject: `Nueva reserva — ${cuando}`,
          intro: 'Se registró una reserva nueva en el portal.',
        };

      case 'reservation.cancelled':
        return {
          subject: `Reserva cancelada — ${cuando}`,
          // Quién canceló es lo primero que la peluquería necesita saber: no es
          // lo mismo que la clienta suelte la cita a que la haya soltado el
          // propio salón desde el panel o desde WhatsApp.
          intro: event.byAdmin
            ? 'Una reserva fue cancelada por la peluquería.'
            : 'Una reserva fue cancelada por la clienta.',
        };

      case 'reservation.rescheduled':
        return {
          subject: `Reserva con fecha cambiada — ${cuando}`,
          intro: event.byAdmin
            ? 'La peluquería movió una reserva de hora.'
            : 'La clienta movió su reserva de hora.',
          extra: `Antes era: ${this.formatear(event.previousScheduledAt)}`,
        };
    }
  }

  /** Siempre en la zona del salón: Railway corre en UTC. */
  private formatear(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: this.config.timeZone,
    }).format(fecha);
  }
}

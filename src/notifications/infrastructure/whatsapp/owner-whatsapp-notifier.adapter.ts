import { Inject, Injectable } from '@nestjs/common';
import {
  OWNER_WHATSAPP_CONFIG,
  WHATSAPP_SENDER,
} from '../../application/tokens';
import { NotifiableEvent } from '../../domain/events/notifiable-event';
import { NotifierPort } from '../../domain/ports/notifier.port';
import {
  WhatsAppMessage,
  WhatsAppSenderPort,
} from '../../domain/ports/whatsapp-sender.port';
import { encodeButtonPayload } from 'src/whatsapp/domain/button-payload';
import { normalizeCoPhoneToE164 } from 'src/common/phone';

export interface OwnerWhatsAppConfig {
  /** Móvil personal de la peluquería. Vacío ⇒ el canal se salta. */
  ownerPhone: string;
  timeZone: string;
  /** Plantilla única de aviso a la peluquería (un parámetro dice qué pasó). */
  templateName: string;
}

/**
 * Avisos a la peluquería por WhatsApp. Gemelo del canal de la clienta, con dos
 * diferencias que importan:
 *
 * 1. **El destinatario es fijo**: el móvil personal de Marlene, que NO es el
 *    número que la Cloud API consume. El número emisor es una línea dedicada;
 *    ella sigue usando su WhatsApp de siempre y recibe estos avisos como
 *    cualquier otro mensaje.
 * 2. **Recibe los tres eventos, incluidos los que provoca ella misma.** Su
 *    conversación es el registro de lo que pasa con la agenda; la clienta, en
 *    cambio, solo recibe lo que decidió el salón.
 *
 * Los botones convierten el aviso en el mando de la agenda: al llegarle una
 * reserva puede confirmarla, cancelarla o moverla sin abrir el panel. Quién
 * puede pulsar qué no lo decide el botón, sino el teléfono remitente cuando el
 * webhook lo recibe.
 *
 * Una plantilla **única** con un parámetro «qué pasó» en vez de tres: cada
 * plantilla es un trámite aparte con Meta y hasta 24 h de revisión.
 */
@Injectable()
export class OwnerWhatsAppNotifier implements NotifierPort {
  readonly channel = 'whatsapp-dueña';

  constructor(
    @Inject(WHATSAPP_SENDER) private readonly sender: WhatsAppSenderPort,
    @Inject(OWNER_WHATSAPP_CONFIG)
    private readonly config: OwnerWhatsAppConfig,
  ) {}

  async notify(event: NotifiableEvent): Promise<void> {
    const to = normalizeCoPhoneToE164(this.config.ownerPhone);
    // Sin número configurado el canal simplemente no existe, igual que el correo
    // sin destinatario: no es un error, es que no está puesto todavía.
    if (!to || !this.config.templateName) return;

    await this.sender.send(this.componer(event, to));
  }

  private componer(event: NotifiableEvent, to: string): WhatsAppMessage {
    const cuando = this.formatear(event.scheduledAt);
    const servicios = event.services.map((s) => s.name).join(', ');

    return {
      kind: 'template',
      to,
      templateName: this.config.templateName,
      bodyParams: [
        this.quePaso(event),
        cuando,
        event.customerName,
        servicios || 'sin servicios',
      ],
      buttons: this.botones(event),
    };
  }

  private quePaso(event: NotifiableEvent): string {
    switch (event.type) {
      case 'reservation.created':
        return 'Reserva nueva';
      case 'reservation.cancelled':
        return event.byAdmin
          ? 'Reserva cancelada por la peluquería'
          : 'Reserva cancelada por la clienta';
      case 'reservation.rescheduled':
        return event.byAdmin
          ? `Hora cambiada por la peluquería (antes: ${this.formatear(event.previousScheduledAt)})`
          : `Hora cambiada por la clienta (antes: ${this.formatear(event.previousScheduledAt)})`;
    }
  }

  /**
   * Una cita cancelada ya no admite nada, así que el aviso va sin botones: una
   * plantilla con botones que no llevan a ninguna parte es peor que ninguno.
   */
  private botones(event: NotifiableEvent) {
    if (event.type === 'reservation.cancelled') return undefined;
    return [
      {
        index: 0,
        payload: encodeButtonPayload({
          action: 'confirm',
          reservationId: event.reservationId,
        }),
      },
      {
        index: 1,
        payload: encodeButtonPayload({
          action: 'cancel',
          reservationId: event.reservationId,
        }),
      },
      {
        index: 2,
        payload: encodeButtonPayload({
          action: 'reschedule',
          reservationId: event.reservationId,
        }),
      },
    ];
  }

  private formatear(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: this.config.timeZone,
    }).format(fecha);
  }
}

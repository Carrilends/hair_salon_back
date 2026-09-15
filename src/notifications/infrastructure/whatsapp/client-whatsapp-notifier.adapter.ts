import { Inject, Injectable } from '@nestjs/common';
import {
  CLIENT_WHATSAPP_CONFIG,
  WHATSAPP_SENDER,
} from '../../application/tokens';
import { NotifiableEvent } from '../../domain/events/notifiable-event';
import { NotifierPort } from '../../domain/ports/notifier.port';
import {
  WhatsAppMessage,
  WhatsAppSenderPort,
} from '../../domain/ports/whatsapp-sender.port';
import { encodeButtonPayload } from 'src/whatsapp/domain/button-payload';
import { assertNever } from '../../domain/events/assert-never';
import { normalizeCoPhoneToE164 } from 'src/common/phone';

export interface ClientWhatsAppConfig {
  timeZone: string; // America/Bogota
  /** Plantillas aprobadas por Meta, una por evento (ver `docs/configs/06`). */
  templateCreated: string;
  templateCancelled: string;
  templateRescheduled: string;
  templateConfirmed: string;
}

/**
 * Canal de avisos a la clienta (Etapa 2). Compone la plantilla que corresponda
 * a cada evento y la entrega al `WhatsAppSenderPort`; no sabe qué proveedor hay
 * detrás. Como el aviso por correo, la hora se expresa en la zona del salón, no
 * en la del servidor (Railway corre en UTC).
 *
 * **A la clienta solo se le cuentan los cambios que hizo la peluquería.** Los
 * suyos ya se los confirmó el canal por el que los hizo, así que repetírselos es
 * ruido —y encima cada plantilla se cobra—. La dueña, en cambio, recibe todo.
 *
 * Degradación elegante (NF11): si la reserva no trae un móvil válido, el canal
 * se salta sin lanzar —los demás siguen y la reserva no se revierte—; si el
 * envío HTTP falla, la excepción sube al despachador, que la aísla.
 */
@Injectable()
export class ClientWhatsAppNotifier implements NotifierPort {
  readonly channel = 'whatsapp';

  constructor(
    @Inject(WHATSAPP_SENDER) private readonly sender: WhatsAppSenderPort,
    @Inject(CLIENT_WHATSAPP_CONFIG)
    private readonly config: ClientWhatsAppConfig,
  ) {}

  async notify(event: NotifiableEvent): Promise<void> {
    const to = normalizeCoPhoneToE164(event.customerPhone);
    if (!to) {
      return;
    }

    const mensaje = this.componer(event, to);
    if (!mensaje) return;

    await this.sender.send(mensaje);
  }

  private componer(event: NotifiableEvent, to: string): WhatsAppMessage | null {
    const cuando = this.formatear(event.scheduledAt);
    const servicios = event.services.map((s) => s.name).join(', ');

    switch (event.type) {
      case 'reservation.created':
        return {
          kind: 'template',
          to,
          templateName: this.config.templateCreated,
          bodyParams: [cuando, event.workerName, servicios],
          // El asa de toda la Etapa 2: el id de la reserva viaja dentro del
          // botón y vuelve intacto en el webhook cuando ella lo pulsa.
          buttons: [
            {
              index: 0,
              payload: encodeButtonPayload({
                action: 'cancel',
                reservationId: event.reservationId,
              }),
            },
            {
              index: 1,
              payload: encodeButtonPayload({
                action: 'reschedule',
                reservationId: event.reservationId,
              }),
            },
          ],
        };

      case 'reservation.cancelled':
        if (!event.byAdmin) return null;
        return {
          kind: 'template',
          to,
          templateName: this.config.templateCancelled,
          bodyParams: [cuando, event.workerName],
        };

      case 'reservation.rescheduled':
        if (!event.byAdmin) return null;
        return {
          kind: 'template',
          to,
          templateName: this.config.templateRescheduled,
          // Antes → después → estilista: el orden lo fija la plantilla aprobada.
          bodyParams: [
            this.formatear(event.previousScheduledAt),
            cuando,
            event.workerName,
          ],
        };

      case 'reservation.confirmed':
        // Siempre la hace la peluquería, así que no hay eco que filtrar: este
        // es el aviso que la clienta más espera.
        return {
          kind: 'template',
          to,
          templateName: this.config.templateConfirmed,
          bodyParams: [cuando, event.workerName],
        };

      default:
        return assertNever(event, 'ClientWhatsAppNotifier');
    }
  }

  private formatear(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: this.config.timeZone,
    }).format(fecha);
  }
}

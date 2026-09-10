import { Inject, Injectable } from '@nestjs/common';
import {
  CLIENT_WHATSAPP_CONFIG,
  WHATSAPP_SENDER,
} from '../../application/tokens';
import { NotifiableEvent } from '../../domain/events/notifiable-event';
import { NotifierPort } from '../../domain/ports/notifier.port';
import { WhatsAppSenderPort } from '../../domain/ports/whatsapp-sender.port';
import { normalizeCoPhoneToE164 } from 'src/common/phone';

export interface ClientWhatsAppConfig {
  timeZone: string; // America/Bogota
}

/**
 * Canal de confirmación a la clienta (Etapa 2). Al crear una reserva compone la
 * plantilla de confirmación y la entrega al `WhatsAppSenderPort`; no sabe qué
 * proveedor hay detrás. Como el aviso por correo, la hora se expresa en la zona
 * del salón, no en la del servidor (Railway corre en UTC).
 *
 * Degradación elegante (NF11): si la reserva no trae un móvil válido, el canal se
 * salta sin lanzar —los demás canales siguen y la reserva no se revierte—; si el
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
    // Igual que el canal de correo: solo redacta la confirmación de reserva
    // nueva. Los avisos de cancelación y de cambio llegan en su propia tarea,
    // con su plantilla y con la regla de a quién se le cuenta qué.
    if (event.type !== 'reservation.created') return;

    const to = normalizeCoPhoneToE164(event.customerPhone);
    if (!to) {
      return;
    }

    const cuando = new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: this.config.timeZone,
    }).format(event.scheduledAt);

    const servicios = event.services.map((s) => s.name).join(', ');

    await this.sender.send({
      to,
      bodyParams: [cuando, event.workerName, servicios],
    });
  }
}

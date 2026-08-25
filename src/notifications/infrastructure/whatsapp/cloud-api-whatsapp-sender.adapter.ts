import {
  WhatsAppMessage,
  WhatsAppSenderPort,
} from '../../domain/ports/whatsapp-sender.port';

export interface CloudApiWhatsAppConfig {
  /** Token Bearer de la Cloud API (ausente ⇒ el módulo usa el adaptador de consola). */
  token?: string;
  /** Id del número emisor en la WABA. */
  phoneNumberId?: string;
  /** Versión de la Graph API, p. ej. `v21.0`. */
  apiVersion: string;
  /** Nombre de la plantilla de utilidad aprobada por Meta para la confirmación. */
  templateName?: string;
  /** Código de idioma de la plantilla, p. ej. `es_CO`. */
  templateLang: string;
}

/**
 * Adaptador real: envía la plantilla de confirmación por la Cloud API de Meta.
 * Único archivo que conoce el endpoint de Graph (regla de dependencias, espejo
 * del adaptador de OpenAI).
 *
 * **Arranque perezoso:** el constructor no toca la red ni valida credenciales;
 * la app arranca aunque falten. Solo un envío real falla, con mensaje claro, si
 * no hay `WHATSAPP_TOKEN` o `WHATSAPP_PHONE_NUMBER_ID`. Un fallo HTTP sube como
 * excepción y el despachador lo aísla (NF11): la reserva ya está persistida.
 *
 * El `fetch` se inyecta (por defecto, el global de Node 20) para poder probar el
 * adaptador sin red.
 */
export class CloudApiWhatsAppSender implements WhatsAppSenderPort {
  constructor(
    private readonly config: CloudApiWhatsAppConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send(message: WhatsAppMessage): Promise<void> {
    if (!this.config.token) {
      throw new Error(
        'WHATSAPP_TOKEN no está configurado: no se puede enviar el WhatsApp de confirmación.',
      );
    }
    if (!this.config.phoneNumberId) {
      throw new Error(
        'WHATSAPP_PHONE_NUMBER_ID no está configurado: no se puede enviar el WhatsApp de confirmación.',
      );
    }

    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: message.to,
      type: 'template',
      template: {
        name: this.config.templateName,
        language: { code: this.config.templateLang },
        components: [
          {
            type: 'body',
            parameters: message.bodyParams.map((text) => ({
              type: 'text',
              text,
            })),
          },
        ],
      },
    };

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Error de la Cloud API de WhatsApp (${response.status}): ${detail}`,
      );
    }
  }
}

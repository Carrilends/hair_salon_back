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
  /** Idioma por defecto de las plantillas; cada mensaje puede pisarlo. */
  templateLang: string;
}

/** Máximo de filas por sección de una lista interactiva (límite de Meta). */
const MAX_LIST_ROWS = 10;

/**
 * Adaptador real: habla con la Cloud API de Meta. Único archivo que conoce el
 * endpoint de Graph y la forma de sus payloads (regla de dependencias, espejo
 * del adaptador del proveedor de IA).
 *
 * **Arranque perezoso:** el constructor no toca la red ni valida credenciales;
 * la app arranca aunque falten. Solo un envío real falla, con mensaje claro. Un
 * fallo HTTP sube como excepción y el despachador lo aísla (NF11): la reserva ya
 * está persistida.
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
        'WHATSAPP_TOKEN no está configurado: no se puede enviar el mensaje de WhatsApp.',
      );
    }
    if (!this.config.phoneNumberId) {
      throw new Error(
        'WHATSAPP_PHONE_NUMBER_ID no está configurado: no se puede enviar el mensaje de WhatsApp.',
      );
    }

    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: message.to,
      ...this.toGraphPayload(message),
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

  /**
   * Traduce cada forma del puerto a su payload de Graph. El `switch` es
   * exhaustivo sobre el discriminante: añadir una forma al puerto no compila
   * hasta que se decide cómo se envía.
   */
  private toGraphPayload(message: WhatsAppMessage): Record<string, unknown> {
    switch (message.kind) {
      case 'template': {
        if (!message.templateName) {
          throw new Error(
            'El mensaje no indica plantilla: la plantilla es del mensaje, no de la aplicación.',
          );
        }
        const components: Record<string, unknown>[] = [
          {
            type: 'body',
            parameters: message.bodyParams.map((text) => ({
              type: 'text',
              text,
            })),
          },
          // Meta pide un componente por botón, con su índice como cadena y el
          // payload que el negocio define al enviar; es lo que vuelve intacto en
          // el webhook cuando la clienta lo pulsa.
          ...(message.buttons ?? []).map((b) => ({
            type: 'button',
            sub_type: 'quick_reply',
            index: String(b.index),
            parameters: [{ type: 'payload', payload: b.payload }],
          })),
        ];
        return {
          type: 'template',
          template: {
            name: message.templateName,
            language: {
              code: message.templateLang ?? this.config.templateLang,
            },
            components,
          },
        };
      }

      case 'text':
        return { type: 'text', text: { body: message.body } };

      case 'interactive-buttons':
        return {
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: message.body },
            action: {
              buttons: message.buttons.map((b) => ({
                type: 'reply',
                reply: { id: b.id, title: b.title },
              })),
            },
          },
        };

      case 'interactive-list': {
        if (message.rows.length > MAX_LIST_ROWS) {
          // Meta la rechazaría igualmente; fallar aquí da un error legible en el
          // log en vez de un 400 opaco de Graph.
          throw new Error(
            `Una lista de WhatsApp admite como máximo ${MAX_LIST_ROWS} filas y llegaron ${message.rows.length}.`,
          );
        }
        return {
          type: 'interactive',
          interactive: {
            type: 'list',
            ...(message.header
              ? { header: { type: 'text', text: message.header } }
              : {}),
            body: { text: message.body },
            ...(message.footer ? { footer: { text: message.footer } } : {}),
            action: {
              button: message.buttonText,
              sections: [{ rows: message.rows }],
            },
          },
        };
      }
    }
  }
}

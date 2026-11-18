import { Injectable, Logger } from '@nestjs/common';
import {
  WhatsAppMessage,
  WhatsAppSenderPort,
} from '../../domain/ports/whatsapp-sender.port';

/**
 * Adaptador de desarrollo: no envía nada, imprime el mensaje. Es el transporte
 * por defecto cuando no hay `WHATSAPP_TOKEN` (espejo del de correo, E3).
 *
 * Imprime **los identificadores de cada botón y de cada fila**, no solo el
 * texto: son lo que hay que reenviar a mano al webhook para ejercitar el flujo
 * completo de cancelar y mover sin credenciales de Meta ni red. Es lo que hace
 * demostrable la Etapa 2 entera antes de que exista la cuenta.
 *
 * En producción queda activo mientras no haya `WHATSAPP_TOKEN` (despliegue del
 * 2026-11-17, F6 pendiente). Ahí no da detalle: los logs del hosting no deben
 * guardar el teléfono de la clienta ni los datos del aviso, así que solo
 * registra el tipo de mensaje y la plantilla (punto 9 del registro de
 * despliegue, `docs/despliegue/registro.md`).
 */
@Injectable()
export class ConsoleWhatsAppSender implements WhatsAppSenderPort {
  private readonly logger = new Logger('WhatsAppSender:console');
  private readonly detalle: boolean;

  constructor(opciones: { detalle?: boolean } = {}) {
    this.detalle = opciones.detalle ?? process.env.NODE_ENV !== 'production';
  }

  async send(message: WhatsAppMessage): Promise<void> {
    if (!this.detalle) {
      const plantilla =
        message.kind === 'template'
          ? ` (plantilla ${message.templateName})`
          : '';
      this.logger.log(
        `WhatsApp no enviado (sin WHATSAPP_TOKEN): ${message.kind}${plantilla}.`,
      );
      return;
    }
    this.logger.log(
      `\n--- WHATSAPP SIMULADO ---\nPara: ${message.to}\n` +
        `${this.describir(message)}\n` +
        `-------------------------`,
    );
  }

  private describir(message: WhatsAppMessage): string {
    switch (message.kind) {
      case 'template': {
        const botones = (message.buttons ?? [])
          .map((b) => `    [${b.index}] payload=${b.payload}`)
          .join('\n');
        return (
          `Plantilla: ${message.templateName} (${message.templateLang ?? 'idioma por defecto'})\n` +
          (message.headerImageUrl
            ? `Imagen: ${message.headerImageUrl}\n`
            : '') +
          `Parámetros: ${message.bodyParams.join(' | ')}` +
          (botones ? `\n  Botones:\n${botones}` : '')
        );
      }

      case 'text':
        return `Texto: ${message.body}`;

      case 'image':
        return (
          `Imagen: ${message.imageUrl}` +
          (message.caption ? `\nPie: ${message.caption}` : '')
        );

      case 'carousel':
        return (
          `Carrusel: ${message.body}\n` +
          message.cards
            .map(
              (c, i) =>
                `    #${i} ${c.imageUrl}\n` +
                `       ${c.body}\n` +
                `       [${c.buttonId}] ${c.buttonTitle}`,
            )
            .join('\n')
        );

      case 'interactive-buttons':
        return (
          `Botones: ${message.body}\n` +
          message.buttons.map((b) => `    [${b.id}] ${b.title}`).join('\n')
        );

      case 'interactive-list':
        return (
          `Lista: ${message.body} (botón: ${message.buttonText})\n` +
          message.rows
            .map(
              (r) =>
                `    [${r.id}] ${r.title}` +
                (r.description ? ` — ${r.description}` : ''),
            )
            .join('\n')
        );
    }
  }
}

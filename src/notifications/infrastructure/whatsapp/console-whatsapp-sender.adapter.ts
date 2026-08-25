import { Injectable, Logger } from '@nestjs/common';
import {
  WhatsAppMessage,
  WhatsAppSenderPort,
} from '../../domain/ports/whatsapp-sender.port';

/**
 * Adaptador de desarrollo: no envía nada, imprime el mensaje. Es el transporte
 * por defecto cuando no hay `WHATSAPP_TOKEN` (espejo del de correo, E3). Permite
 * ejercitar el flujo completo de confirmación sin credenciales de Meta ni red.
 * NUNCA debe quedar activo en producción.
 */
@Injectable()
export class ConsoleWhatsAppSender implements WhatsAppSenderPort {
  private readonly logger = new Logger('WhatsAppSender:console');

  async send(message: WhatsAppMessage): Promise<void> {
    this.logger.log(
      `\n--- WHATSAPP SIMULADO ---\nPara: ${message.to}\n` +
        `Parámetros: ${message.bodyParams.join(' | ')}\n` +
        `-------------------------`,
    );
  }
}

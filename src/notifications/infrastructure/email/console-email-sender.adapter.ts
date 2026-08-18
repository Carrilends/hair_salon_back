import { Injectable, Logger } from '@nestjs/common';
import {
  EmailMessage,
  EmailSenderPort,
} from '../../domain/ports/email-sender.port';

/**
 * Adaptador de desarrollo: no envía nada, imprime el mensaje. Permite ejercitar
 * los flujos completos de reset y verificación sin proveedor contratado (E3).
 * NUNCA debe quedar activo en producción.
 */
@Injectable()
export class ConsoleEmailSenderAdapter implements EmailSenderPort {
  private readonly logger = new Logger('EmailSender:console');

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `\n--- CORREO SIMULADO ---\nPara: ${message.to}\nAsunto: ${message.subject}\n\n${message.text}\n-----------------------`,
    );
  }
}

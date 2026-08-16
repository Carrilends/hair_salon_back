import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailMessage,
  EmailSenderPort,
} from '../../domain/ports/email-sender.port';

/**
 * Adaptador de correo real. El proveedor concreto queda diferido (E3): cuando
 * se elija, se integra su SDK dentro de `send()` usando `EMAIL_API_KEY` y
 * `EMAIL_FROM`. Mientras tanto, `send()` falla de forma explícita para que la
 * ausencia de integración sea evidente y NUNCA se caiga silenciosamente un
 * correo en producción. El `useFactory` del módulo solo lo activa cuando
 * `EMAIL_PROVIDER` está configurado.
 *
 * ### Sustituir el cuerpo de `send()` por la llamada al SDK del proveedor
 * elegido y documentar sus variables en `.env.example`.
 */
@Injectable()
export class ProviderEmailSenderAdapter implements EmailSenderPort {
  private readonly logger = new Logger('EmailSender:provider');

  constructor(private readonly config: ConfigService) {}

  async send(message: EmailMessage): Promise<void> {
    const provider = this.config.get<string>('EMAIL_PROVIDER');
    this.logger.error(
      `EMAIL_PROVIDER='${provider}' está configurado pero su SDK aún no se ha ` +
        `integrado. No se envió el correo a ${message.to}.`,
    );
    throw new Error(
      'Proveedor de correo no integrado: complete ProviderEmailSenderAdapter.send().',
    );
  }
}

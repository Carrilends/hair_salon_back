import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { verifyMetaSignature } from './meta-signature';

/**
 * Deja pasar solo lo que venga firmado por Meta.
 *
 * **Falla cerrado, y a propósito no hay forma de desactivarlo.** No existe
 * ninguna variable tipo `WEBHOOK_INSECURE`: una puerta así siempre acaba abierta
 * en producción. Para desarrollo se firma la petición con `curl` usando el mismo
 * HMAC, que además es la manera de demostrar el canal entero sin cuenta de Meta.
 */
@Injectable()
export class MetaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(MetaSignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      rawBody?: Buffer;
    }>();

    const ok = verifyMetaSignature(
      request.rawBody,
      request.headers['x-hub-signature-256'],
      process.env.WHATSAPP_APP_SECRET,
    );

    if (!ok) {
      // Sin detalles en la respuesta: a quien no pasa no se le explica por qué.
      this.logger.warn('Webhook de WhatsApp rechazado: firma inválida');
    }

    return ok;
  }
}

import { EmailMessage } from 'src/notifications/domain/ports/email-sender.port';
import { renderBrandedEmail } from 'src/notifications/application/branded-email';

export interface AuthLinks {
  resetPasswordUrl: string; // p. ej. https://…/auth/restablecer
  verifyEmailUrl: string; // p. ej. https://…/auth/verificar-correo
}

/**
 * Compone los dos correos de autenticación. Cada mensaje lleva `text` **y**
 * `html`: el texto plano se conserva intacto como alternativa para clientes que
 * no muestran HTML, y el envoltorio de marca repite el enlace como texto
 * copiable. En estos dos correos el enlace es el mensaje —lleva el token—, así
 * que un correo del que no se pueda extraer el enlace es un correo inservible.
 */
export class AuthEmailComposer {
  constructor(private readonly links: AuthLinks) {}

  passwordReset(to: string, fullName: string, rawToken: string): EmailMessage {
    const link = `${this.links.resetPasswordUrl}?token=${encodeURIComponent(
      rawToken,
    )}`;
    return {
      to,
      subject: 'Restablece tu contraseña — Peluquería Marlene',
      text:
        `Hola ${fullName}:\n\n` +
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta.\n' +
        `Abre este enlace para elegir una nueva: ${link}\n\n` +
        'El enlace vence en 30 minutos y solo puede usarse una vez.\n' +
        'Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.\n',
      html: renderBrandedEmail({
        title: 'Restablece tu contraseña',
        paragraphs: [
          `Hola ${fullName}:`,
          'Recibimos una solicitud para restablecer la contraseña de tu cuenta.',
        ],
        action: { label: 'Elegir contraseña nueva', url: link },
        footnote:
          'El enlace vence en 30 minutos y solo puede usarse una vez. Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.',
      }),
    };
  }

  emailVerification(
    to: string,
    fullName: string,
    rawToken: string,
  ): EmailMessage {
    const link = `${this.links.verifyEmailUrl}?token=${encodeURIComponent(
      rawToken,
    )}`;
    return {
      to,
      subject: 'Confirma tu correo — Peluquería Marlene',
      text:
        `Hola ${fullName}:\n\n` +
        `Confirma tu correo abriendo este enlace: ${link}\n\n` +
        'El enlace vence en 24 horas.\n',
      html: renderBrandedEmail({
        title: 'Confirma tu correo',
        paragraphs: [
          `Hola ${fullName}:`,
          'Solo falta un paso para activar tu cuenta en el portal de la peluquería.',
        ],
        action: { label: 'Confirmar mi correo', url: link },
        footnote: 'El enlace vence en 24 horas.',
      }),
    };
  }
}

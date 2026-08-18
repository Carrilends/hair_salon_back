import { EmailMessage } from 'src/notifications/domain/ports/email-sender.port';

export interface AuthLinks {
  resetPasswordUrl: string; // p. ej. https://…/auth/restablecer
  verifyEmailUrl: string; // p. ej. https://…/auth/verificar-correo
}

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
    };
  }
}

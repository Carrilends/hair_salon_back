import { AuthEmailComposer } from './auth-email-composer';
import { SALON_NAME } from 'src/notifications/application/branded-email';

/**
 * Los dos correos de autenticación llevan un token en la URL, así que el enlace
 * es el mensaje: si no se puede abrir ni copiar, el correo no sirve. Por eso se
 * envía `text` **y** `html`, y el texto plano se conserva intacto como
 * alternativa para clientes que no muestran HTML.
 */
const composer = new AuthEmailComposer({
  resetPasswordUrl: 'https://peluqueriamarlene.com/auth/restablecer',
  verifyEmailUrl: 'https://peluqueriamarlene.com/auth/verificar-correo',
});

describe('AuthEmailComposer', () => {
  describe('passwordReset', () => {
    const message = composer.passwordReset('ana@ejemplo.com', 'Ana', 'tok en');
    const link =
      'https://peluqueriamarlene.com/auth/restablecer?token=tok%20en';

    it('conserva el texto plano con el enlace, la vigencia y el aviso', () => {
      expect(message.text).toBe(
        'Hola Ana:\n\n' +
          'Recibimos una solicitud para restablecer la contraseña de tu cuenta.\n' +
          `Abre este enlace para elegir una nueva: ${link}\n\n` +
          'El enlace vence en 30 minutos y solo puede usarse una vez.\n' +
          'Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.\n',
      );
    });

    it('añade un cuerpo HTML con la marca y el mismo enlace', () => {
      expect(message.html).toBeDefined();
      expect(message.html).toContain(SALON_NAME);
      expect(message.html).toContain(link);
    });
  });

  describe('emailVerification', () => {
    const message = composer.emailVerification(
      'ana@ejemplo.com',
      'Ana',
      'tok en',
    );
    const link =
      'https://peluqueriamarlene.com/auth/verificar-correo?token=tok%20en';

    it('conserva el texto plano con el enlace y la vigencia', () => {
      expect(message.text).toBe(
        'Hola Ana:\n\n' +
          `Confirma tu correo abriendo este enlace: ${link}\n\n` +
          'El enlace vence en 24 horas.\n',
      );
    });

    it('añade un cuerpo HTML con la marca y el mismo enlace', () => {
      expect(message.html).toBeDefined();
      expect(message.html).toContain(SALON_NAME);
      expect(message.html).toContain(link);
    });
  });
});

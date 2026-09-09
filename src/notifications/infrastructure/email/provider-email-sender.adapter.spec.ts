import {
  ProviderEmailSenderAdapter,
  ResendLikeClient,
  ResendSendPayload,
} from './provider-email-sender.adapter';

/**
 * Adaptador real de correo (Resend). Arranque perezoso, como el adaptador de
 * WhatsApp: el constructor no valida credenciales ni toca la red, así que la app
 * arranca sin `EMAIL_API_KEY`; solo un envío real falla, con mensaje claro.
 *
 * La prueba central de este archivo es la del `error` del proveedor: el SDK de
 * Resend **no lanza**, devuelve `{ data, error }`. Sin inspeccionar `error`, un
 * fallo de entrega pasaría por éxito, que es justo el silencio que el stub
 * anterior existía para evitar.
 */
type Captured = { payload?: ResendSendPayload };

function fakeClient(
  captured: Captured,
  result: {
    data?: { id: string } | null;
    error?: { statusCode?: number; name?: string; message?: string } | null;
  },
): ResendLikeClient {
  return {
    emails: {
      send: async (payload: ResendSendPayload) => {
        captured.payload = payload;
        return {
          data: result.data ?? null,
          error: result.error ?? null,
        };
      },
    },
  };
}

describe('ProviderEmailSenderAdapter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.EMAIL_API_KEY = 're_test_key';
    process.env.EMAIL_FROM =
      'Peluquería Marlene <no-reply@notifications.peluqueriamarlene.com>';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('traslada destinatario, asunto, texto y HTML, y toma el remitente de EMAIL_FROM', async () => {
    const captured: Captured = {};
    const adapter = new ProviderEmailSenderAdapter(() =>
      fakeClient(captured, { data: { id: 'msg_123' } }),
    );

    await expect(
      adapter.send({
        to: 'clienta@ejemplo.com',
        subject: 'Verifica tu correo',
        text: 'Abre este enlace: https://ejemplo.com/verificar?token=abc',
        html: '<p>Abre este enlace</p>',
      }),
    ).resolves.toBeUndefined();

    expect(captured.payload).toEqual({
      from: 'Peluquería Marlene <no-reply@notifications.peluqueriamarlene.com>',
      to: ['clienta@ejemplo.com'],
      subject: 'Verifica tu correo',
      text: 'Abre este enlace: https://ejemplo.com/verificar?token=abc',
      html: '<p>Abre este enlace</p>',
    });
  });

  it('convierte en excepción el `error` que el SDK devuelve sin lanzar', async () => {
    const adapter = new ProviderEmailSenderAdapter(() =>
      fakeClient(
        {},
        {
          error: {
            statusCode: 403,
            name: 'validation_error',
            message: 'The domain is not verified',
          },
        },
      ),
    );

    await expect(
      adapter.send({
        to: 'clienta@ejemplo.com',
        subject: 'Verifica tu correo',
        text: 'texto',
      }),
    ).rejects.toThrow(/The domain is not verified/);
  });

  it('falla explícitamente y sin llamar al proveedor cuando falta EMAIL_API_KEY', async () => {
    delete process.env.EMAIL_API_KEY;
    let clientCreated = false;
    const adapter = new ProviderEmailSenderAdapter(() => {
      clientCreated = true;
      return fakeClient({}, { data: { id: 'no-deberia-llegar' } });
    });

    await expect(
      adapter.send({
        to: 'clienta@ejemplo.com',
        subject: 'Verifica tu correo',
        text: 'texto',
      }),
    ).rejects.toThrow(/EMAIL_API_KEY/);

    expect(clientCreated).toBe(false);
  });
});

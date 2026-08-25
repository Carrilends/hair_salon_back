import {
  CloudApiWhatsAppConfig,
  CloudApiWhatsAppSender,
} from './cloud-api-whatsapp-sender.adapter';

/**
 * Adaptador real contra la Cloud API de Meta. Envía una plantilla aprobada por
 * `POST /{version}/{phoneNumberId}/messages`. Arranque perezoso: la app arranca
 * sin credenciales; solo un envío real falla, con mensaje claro, si faltan. El
 * `fetch` se inyecta para probar sin red (como el cliente opcional del adaptador
 * de OpenAI).
 */
const baseConfig: CloudApiWhatsAppConfig = {
  token: 'TOK',
  phoneNumberId: '123456',
  apiVersion: 'v21.0',
  templateName: 'confirmacion_reserva',
  templateLang: 'es_CO',
};

type Captured = {
  url?: unknown;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
};

function fakeFetch(
  captured: Captured,
  response: { ok: boolean; status: number; body?: string },
) {
  const fn = async (url: unknown, init: unknown) => {
    captured.url = url;
    captured.init = init as Captured['init'];
    return {
      ok: response.ok,
      status: response.status,
      text: async () => response.body ?? '',
    };
  };
  return fn as unknown as typeof fetch;
}

describe('CloudApiWhatsAppSender', () => {
  it('arma la URL, los headers y el cuerpo de plantilla y resuelve en 2xx', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, {
        ok: true,
        status: 200,
        body: '{"messages":[{"id":"wamid.X"}]}',
      }),
    );

    await expect(
      sender.send({
        to: '573001234567',
        bodyParams: ['sábado', 'Ana', 'Corte'],
      }),
    ).resolves.toBeUndefined();

    expect(captured.url).toBe(
      'https://graph.facebook.com/v21.0/123456/messages',
    );
    expect(captured.init?.method).toBe('POST');
    expect(captured.init?.headers?.Authorization).toBe('Bearer TOK');
    expect(captured.init?.headers?.['Content-Type']).toBe('application/json');

    const body = JSON.parse(captured.init?.body ?? '{}');
    expect(body.messaging_product).toBe('whatsapp');
    expect(body.to).toBe('573001234567');
    expect(body.type).toBe('template');
    expect(body.template.name).toBe('confirmacion_reserva');
    expect(body.template.language.code).toBe('es_CO');
    expect(body.template.components[0].type).toBe('body');
    expect(body.template.components[0].parameters).toEqual([
      { type: 'text', text: 'sábado' },
      { type: 'text', text: 'Ana' },
      { type: 'text', text: 'Corte' },
    ]);
  });

  it('lanza un error claro y no llama a la red si falta el token', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      { ...baseConfig, token: undefined },
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await expect(
      sender.send({ to: '573001234567', bodyParams: [] }),
    ).rejects.toThrow(/WHATSAPP_TOKEN/);
    expect(captured.url).toBeUndefined();
  });

  it('lanza un error claro y no llama a la red si falta el phoneNumberId', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      { ...baseConfig, phoneNumberId: undefined },
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await expect(
      sender.send({ to: '573001234567', bodyParams: [] }),
    ).rejects.toThrow(/WHATSAPP_PHONE_NUMBER_ID/);
    expect(captured.url).toBeUndefined();
  });

  it('propaga un error con el estado y el cuerpo si la respuesta no es 2xx', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, {
        ok: false,
        status: 401,
        body: '{"error":{"message":"token inválido"}}',
      }),
    );

    await expect(
      sender.send({ to: '573001234567', bodyParams: ['x'] }),
    ).rejects.toThrow(/401/);
    expect(captured.url).toBeDefined();
  });
});

import {
  CloudApiWhatsAppConfig,
  CloudApiWhatsAppSender,
} from './cloud-api-whatsapp-sender.adapter';
import { WhatsAppMessage } from '../../domain/ports/whatsapp-sender.port';

/**
 * Adaptador real contra la Cloud API de Meta. Envía una plantilla aprobada por
 * `POST /{version}/{phoneNumberId}/messages`. Arranque perezoso: la app arranca
 * sin credenciales; solo un envío real falla, con mensaje claro, si faltan. El
 * `fetch` se inyecta para probar sin red (como el cliente opcional del adaptador
 * del proveedor de IA).
 */
const baseConfig: CloudApiWhatsAppConfig = {
  token: 'TOK',
  phoneNumberId: '123456',
  apiVersion: 'v21.0',
  templateLang: 'es_CO',
};

const PLANTILLA: WhatsAppMessage & { kind: 'template' } = {
  kind: 'template',
  to: '573001234567',
  templateName: 'confirmacion_reserva',
  bodyParams: ['sábado', 'Ana', 'Corte'],
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

    await expect(sender.send({ ...PLANTILLA })).resolves.toBeUndefined();

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

    await expect(sender.send({ ...PLANTILLA })).rejects.toThrow(
      /WHATSAPP_TOKEN/,
    );
    expect(captured.url).toBeUndefined();
  });

  it('lanza un error claro y no llama a la red si falta el phoneNumberId', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      { ...baseConfig, phoneNumberId: undefined },
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await expect(sender.send({ ...PLANTILLA })).rejects.toThrow(
      /WHATSAPP_PHONE_NUMBER_ID/,
    );
    expect(captured.url).toBeUndefined();
  });

  it('lanza un error claro y no llama a la red si el mensaje no trae plantilla', async () => {
    // La plantilla es del mensaje, no de la aplicación: quien la omite tiene un
    // fallo de programación, no de configuración, y conviene que se note.
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await expect(
      sender.send({ ...PLANTILLA, templateName: '' }),
    ).rejects.toThrow(/plantilla/i);
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

    await expect(sender.send({ ...PLANTILLA })).rejects.toThrow(/401/);
    expect(captured.url).toBeDefined();
  });

  it('el idioma del mensaje pisa el del adaptador', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await sender.send({ ...PLANTILLA, templateLang: 'es_MX' });

    const body = JSON.parse(captured.init?.body ?? '{}');
    expect(body.template.language.code).toBe('es_MX');
  });

  it('adjunta los botones de respuesta rápida como componentes por posición', async () => {
    // Es lo que hace que la confirmación lleve «Cancelar cita» y «Cambiar
    // fecha»: Meta pide un componente `button` por botón, con su índice y el
    // payload que el negocio define al enviar.
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await sender.send({
      ...PLANTILLA,
      buttons: [
        { index: 0, payload: 'CANCEL|r-1' },
        { index: 1, payload: 'RESCHED|r-1' },
      ],
    });

    const body = JSON.parse(captured.init?.body ?? '{}');
    const botones = body.template.components.filter(
      (c: { type: string }) => c.type === 'button',
    );
    expect(botones).toEqual([
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: '0',
        parameters: [{ type: 'payload', payload: 'CANCEL|r-1' }],
      },
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: '1',
        parameters: [{ type: 'payload', payload: 'RESCHED|r-1' }],
      },
    ]);
  });

  it('pone la cabecera de imagen antes del cuerpo cuando el mensaje la trae', async () => {
    // Plan 06, F1. Meta empareja los componentes por tipo, pero la cabecera va
    // primero en su propia documentación y así se lee el payload en el log.
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await sender.send({
      ...PLANTILLA,
      headerImageUrl:
        'https://res.cloudinary.com/demo/image/upload/f_jpg,w_800/v1/c.jpg',
    });

    const components = JSON.parse(captured.init?.body ?? '{}').template
      .components;
    expect(components[0]).toEqual({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: {
            link: 'https://res.cloudinary.com/demo/image/upload/f_jpg,w_800/v1/c.jpg',
          },
        },
      ],
    });
    expect(components[1].type).toBe('body');
  });

  it('sin imagen no manda componente de cabecera (las plantillas de texto lo rechazarían)', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await sender.send({ ...PLANTILLA });

    const components = JSON.parse(captured.init?.body ?? '{}').template
      .components;
    expect(components.map((c: { type: string }) => c.type)).not.toContain(
      'header',
    );
  });

  it('envía texto libre como type text', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await sender.send({
      kind: 'text',
      to: '573001234567',
      body: 'Listo, tu cita quedó cancelada.',
    });

    const body = JSON.parse(captured.init?.body ?? '{}');
    expect(body.type).toBe('text');
    expect(body.text).toEqual({ body: 'Listo, tu cita quedó cancelada.' });
  });

  it('envía botones interactivos dentro de la ventana de 24 h, sin plantilla', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await sender.send({
      kind: 'interactive-buttons',
      to: '573001234567',
      body: '¿Seguro que quieres cancelar?',
      buttons: [
        { id: 'CANCEL_OK|r-1', title: 'Sí, cancelar' },
        { id: 'NOOP', title: 'No, dejarla' },
      ],
    });

    const body = JSON.parse(captured.init?.body ?? '{}');
    expect(body.type).toBe('interactive');
    expect(body.interactive.type).toBe('button');
    expect(body.interactive.body).toEqual({
      text: '¿Seguro que quieres cancelar?',
    });
    expect(body.interactive.action.buttons).toEqual([
      { type: 'reply', reply: { id: 'CANCEL_OK|r-1', title: 'Sí, cancelar' } },
      { type: 'reply', reply: { id: 'NOOP', title: 'No, dejarla' } },
    ]);
  });

  it('envía una lista interactiva con sus filas', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await sender.send({
      kind: 'interactive-list',
      to: '573001234567',
      header: 'Cambiar fecha',
      body: 'Elige el día',
      footer: 'Peluquería Marlene',
      buttonText: 'Ver días',
      rows: [
        { id: 'RSDAY|r-1|2026-09-12', title: 'vie 12 sep' },
        {
          id: 'RSDAY|r-1|2026-09-13',
          title: 'sáb 13 sep',
          description: '3 horas libres',
        },
      ],
    });

    const body = JSON.parse(captured.init?.body ?? '{}');
    expect(body.interactive.type).toBe('list');
    expect(body.interactive.header).toEqual({
      type: 'text',
      text: 'Cambiar fecha',
    });
    expect(body.interactive.footer).toEqual({ text: 'Peluquería Marlene' });
    expect(body.interactive.action.button).toBe('Ver días');
    expect(body.interactive.action.sections[0].rows).toEqual([
      { id: 'RSDAY|r-1|2026-09-12', title: 'vie 12 sep' },
      {
        id: 'RSDAY|r-1|2026-09-13',
        title: 'sáb 13 sep',
        description: '3 horas libres',
      },
    ]);
  });

  it('rechaza una lista con más de diez filas antes de llamar a la red', async () => {
    // Meta la rechazaría igualmente; fallar aquí da un error legible en el log en
    // vez de un 400 opaco de Graph.
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await expect(
      sender.send({
        kind: 'interactive-list',
        to: '573001234567',
        body: 'Elige',
        buttonText: 'Ver',
        rows: Array.from({ length: 11 }, (_, i) => ({
          id: `X|${i}`,
          title: `Fila ${i}`,
        })),
      }),
    ).rejects.toThrow(/10 filas/);
    expect(captured.url).toBeUndefined();
  });
  it('envía una imagen por enlace, con su pie (plan 06, F5)', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await sender.send({
      kind: 'image',
      to: '573001234567',
      imageUrl:
        'https://res.cloudinary.com/x/image/upload/f_jpg,w_800,c_limit/v1/a.jpg',
      caption: 'Corte: $ 35.000 (45 min)',
    });

    const body = JSON.parse(captured.init?.body ?? '{}');
    expect(body).toEqual({
      messaging_product: 'whatsapp',
      to: '573001234567',
      type: 'image',
      image: {
        link: 'https://res.cloudinary.com/x/image/upload/f_jpg,w_800,c_limit/v1/a.jpg',
        caption: 'Corte: $ 35.000 (45 min)',
      },
    });
  });

  it('una imagen sin pie no manda caption', async () => {
    const captured: Captured = {};
    const sender = new CloudApiWhatsAppSender(
      baseConfig,
      fakeFetch(captured, { ok: true, status: 200 }),
    );

    await sender.send({
      kind: 'image',
      to: '573001234567',
      imageUrl: 'https://res.cloudinary.com/x/a.jpg',
    });

    const body = JSON.parse(captured.init?.body ?? '{}');
    expect(body.image).toEqual({ link: 'https://res.cloudinary.com/x/a.jpg' });
  });
});

import { createHmac } from 'node:crypto';
import { ExecutionContext } from '@nestjs/common';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { MetaSignatureGuard } from './meta-signature.guard';
import { InboundRateLimiter } from '../../application/rate-limiter';

const SECRETO = 'app-secret';

function respuesta() {
  const capturado: { status?: number; body?: string } = {};
  const res = {
    status: (n: number) => {
      capturado.status = n;
      return {
        send: (b?: string) => {
          capturado.body = b;
        },
      };
    },
  };
  return { res, capturado };
}

function sobreConMensaje(id = 'wamid.A', from = '573001112233') {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ id, from, type: 'text', text: { body: 'hola' } }],
            },
          },
        ],
      },
    ],
  };
}

function montar(opciones: { yaVisto?: boolean; limite?: number } = {}) {
  const atendidos: string[] = [];
  const handler = {
    handle: async (m: { messageId: string }) => {
      atendidos.push(m.messageId);
    },
  };
  const vistos = new Set<string>();
  const log = {
    markProcessedIfNew: async (id: string) => {
      if (opciones.yaVisto || vistos.has(id)) return false;
      vistos.add(id);
      return true;
    },
    deleteOlderThan: async () => undefined,
  };
  const limiter = new InboundRateLimiter(opciones.limite ?? 100, 60_000);
  const controller = new WhatsAppWebhookController(
    handler as never,
    log as never,
    limiter,
  );
  return { controller, atendidos };
}

/** Espera a que se vacíen los trabajos lanzados sin `await`. */
const dejarCorrerLoDiferido = () => new Promise((r) => setImmediate(r));

describe('WhatsAppWebhookController · verificación de la URL', () => {
  const original = process.env.WHATSAPP_VERIFY_TOKEN;
  afterEach(() => {
    if (original === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = original;
  });

  it('devuelve el challenge EN TEXTO PLANO con el token correcto', () => {
    // Meta espera el número tal cual, no un JSON: si se le devuelve `{"...":1}`
    // la verificación de la URL falla en el panel sin decir por qué.
    process.env.WHATSAPP_VERIFY_TOKEN = 'secreto-elegido-por-nosotros';
    const { controller } = montar();
    const { res, capturado } = respuesta();

    controller.verify(
      'subscribe',
      'secreto-elegido-por-nosotros',
      '1158201444',
      res as never,
    );

    expect(capturado.status).toBe(200);
    expect(capturado.body).toBe('1158201444');
  });

  it('rechaza con 403 si el token no coincide', () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'el-bueno';
    const { controller } = montar();
    const { res, capturado } = respuesta();

    controller.verify('subscribe', 'el-malo', '123', res as never);

    expect(capturado.status).toBe(403);
    expect(capturado.body).toBeUndefined();
  });

  it('rechaza si el modo no es subscribe', () => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'el-bueno';
    const { controller } = montar();
    const { res, capturado } = respuesta();

    controller.verify('unsubscribe', 'el-bueno', '123', res as never);

    expect(capturado.status).toBe(403);
  });

  it('FALLA CERRADO si no hay token configurado', () => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    const { controller } = montar();
    const { res, capturado } = respuesta();

    controller.verify('subscribe', 'lo-que-sea', '123', res as never);

    expect(capturado.status).toBe(403);
  });
});

describe('WhatsAppWebhookController · entrega de mensajes', () => {
  it('responde 200 SIN esperar al manejador', async () => {
    // Meta reintenta con backoff durante días ante cualquier respuesta lenta o
    // que no sea 2xx: tardar aquí convierte un mensaje en una avalancha.
    const { controller, atendidos } = montar();

    const respuestaHttp = controller.receive({ body: sobreConMensaje() });

    expect(respuestaHttp).toEqual({ ok: true });
    expect(atendidos).toHaveLength(0); // aún no ha corrido

    await dejarCorrerLoDiferido();
    expect(atendidos).toEqual(['wamid.A']);
  });

  it('un fallo del manejador NO cambia el 200 ya respondido', async () => {
    const handler = {
      handle: async () => {
        throw new Error('algo explotó');
      },
    };
    const controller = new WhatsAppWebhookController(
      handler as never,
      {
        markProcessedIfNew: async () => true,
        deleteOlderThan: async () => undefined,
      } as never,
      new InboundRateLimiter(100, 60_000),
    );

    expect(controller.receive({ body: sobreConMensaje() })).toEqual({
      ok: true,
    });

    // Lo que importa es que el rechazo del trabajo diferido quede capturado: una
    // promesa rechazada sin `catch` tumbaría el proceso en Node.
    const sinCapturar = jest.fn();
    process.once('unhandledRejection', sinCapturar);
    await dejarCorrerLoDiferido();
    process.off('unhandledRejection', sinCapturar);

    expect(sinCapturar).not.toHaveBeenCalled();
  });

  it('la reentrega del MISMO mensaje se procesa una sola vez', async () => {
    const { controller, atendidos } = montar();

    controller.receive({ body: sobreConMensaje('wamid.REPETIDO') });
    await dejarCorrerLoDiferido();
    controller.receive({ body: sobreConMensaje('wamid.REPETIDO') });
    await dejarCorrerLoDiferido();

    expect(atendidos).toEqual(['wamid.REPETIDO']);
  });

  it('pasado el límite descarta el trabajo pero SIGUE respondiendo 200', async () => {
    // Un 429 sería contraproducente: Meta lo trata como fallo y reintentaría,
    // empeorando justo lo que se quería contener.
    const { controller, atendidos } = montar({ limite: 1 });

    controller.receive({ body: sobreConMensaje('wamid.1') });
    await dejarCorrerLoDiferido();
    const segunda = controller.receive({ body: sobreConMensaje('wamid.2') });
    await dejarCorrerLoDiferido();

    expect(segunda).toEqual({ ok: true });
    expect(atendidos).toEqual(['wamid.1']);
  });

  it('un sobre sin mensajes (solo acuses) no hace nada y responde 200', async () => {
    const { controller, atendidos } = montar();

    const r = controller.receive({
      body: { entry: [{ changes: [{ value: { statuses: [{ id: 'x' }] } }] }] },
    });
    await dejarCorrerLoDiferido();

    expect(r).toEqual({ ok: true });
    expect(atendidos).toHaveLength(0);
  });

  it('un cuerpo con basura no lanza', async () => {
    const { controller } = montar();
    expect(() => controller.receive({ body: 'no soy json' })).not.toThrow();
  });
});

describe('MetaSignatureGuard', () => {
  const original = process.env.WHATSAPP_APP_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = original;
  });

  function contexto(rawBody: Buffer | undefined, firma: string | undefined) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-hub-signature-256': firma },
          rawBody,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('deja pasar una petición firmada', () => {
    process.env.WHATSAPP_APP_SECRET = SECRETO;
    const cuerpo = Buffer.from('{"a":1}');
    const firma = `sha256=${createHmac('sha256', SECRETO).update(cuerpo).digest('hex')}`;

    expect(new MetaSignatureGuard().canActivate(contexto(cuerpo, firma))).toBe(
      true,
    );
  });

  it('rechaza una firma alterada', () => {
    process.env.WHATSAPP_APP_SECRET = SECRETO;
    const cuerpo = Buffer.from('{"a":1}');

    expect(
      new MetaSignatureGuard().canActivate(contexto(cuerpo, 'sha256=00ff')),
    ).toBe(false);
  });

  it('FALLA CERRADO sin cuerpo crudo', () => {
    // Si `rawBody: true` desapareciera de `main.ts`, el canal se cierra en vez
    // de aceptar cualquier cosa.
    process.env.WHATSAPP_APP_SECRET = SECRETO;
    const firma = `sha256=${createHmac('sha256', SECRETO).update(Buffer.from('{}')).digest('hex')}`;

    expect(
      new MetaSignatureGuard().canActivate(contexto(undefined, firma)),
    ).toBe(false);
  });

  it('FALLA CERRADO sin secreto configurado', () => {
    delete process.env.WHATSAPP_APP_SECRET;
    const cuerpo = Buffer.from('{"a":1}');
    const firma = `sha256=${createHmac('sha256', SECRETO).update(cuerpo).digest('hex')}`;

    expect(new MetaSignatureGuard().canActivate(contexto(cuerpo, firma))).toBe(
      false,
    );
  });
});

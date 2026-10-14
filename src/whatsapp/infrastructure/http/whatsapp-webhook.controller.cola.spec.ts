import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { InboundRateLimiter } from '../../application/rate-limiter';

/**
 * Plan 06, F2: el controlador sigue respondiendo a Meta al instante, pero ya no
 * procesa a la vez dos mensajes del mismo número.
 */
function sobre(mensajes: { id: string; from: string }[]) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: mensajes.map((m) => ({
                ...m,
                type: 'text',
                text: { body: m.id },
              })),
            },
          },
        ],
      },
    ],
  };
}

function montar() {
  const traza: string[] = [];
  const liberar = new Map<string, () => void>();
  const handler = {
    handle: (m: { messageId: string }) => {
      traza.push(`${m.messageId}:empieza`);
      return new Promise<void>((resolver) =>
        liberar.set(m.messageId, () => {
          traza.push(`${m.messageId}:termina`);
          resolver();
        }),
      );
    },
  };
  const log = { markProcessedIfNew: async () => true };
  const controller = new WhatsAppWebhookController(
    handler as never,
    log as never,
    new InboundRateLimiter(100, 60_000),
  );
  return { controller, traza, liberar };
}

const vaciar = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

describe('WhatsAppWebhookController · cola por remitente (plan 06, F2)', () => {
  it('dos mensajes del mismo número se atienden en serie, en el orden de Meta', async () => {
    const { controller, traza, liberar } = montar();

    expect(
      controller.receive({
        body: sobre([
          { id: 'wamid.1', from: '573001112233' },
          { id: 'wamid.2', from: '573001112233' },
        ]),
      }),
    ).toEqual({ ok: true });

    await vaciar();
    expect(traza).toEqual(['wamid.1:empieza']);

    liberar.get('wamid.1')!();
    await vaciar();
    expect(traza).toEqual([
      'wamid.1:empieza',
      'wamid.1:termina',
      'wamid.2:empieza',
    ]);
    liberar.get('wamid.2')!();
  });

  it('también entre dos entregas distintas del webhook', async () => {
    const { controller, traza, liberar } = montar();

    controller.receive({
      body: sobre([{ id: 'wamid.1', from: '573001112233' }]),
    });
    controller.receive({
      body: sobre([{ id: 'wamid.2', from: '573001112233' }]),
    });

    await vaciar();
    expect(traza).toEqual(['wamid.1:empieza']);
    liberar.get('wamid.1')!();
    await vaciar();
    expect(traza).toContain('wamid.2:empieza');
    liberar.get('wamid.2')!();
  });

  it('los de números distintos van en paralelo', async () => {
    const { controller, traza, liberar } = montar();

    controller.receive({
      body: sobre([
        { id: 'wamid.1', from: '573001112233' },
        { id: 'wamid.2', from: '573009998888' },
      ]),
    });

    await vaciar();
    expect(traza).toEqual(['wamid.1:empieza', 'wamid.2:empieza']);
    liberar.get('wamid.1')!();
    liberar.get('wamid.2')!();
  });
});

describe('WhatsAppWebhookController · envíos fallidos (plan 06, F2)', () => {
  it('registra en el log el envío que Meta no pudo entregar, y responde 200 igual', () => {
    const { controller } = montar();
    const warn = jest
      .spyOn(
        (controller as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);

    const r = controller.receive({
      body: {
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: 'wamid.MAL',
                      status: 'failed',
                      recipient_id: '573001112233',
                      errors: [{ code: 131053, title: 'Media upload error' }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    });

    expect(r).toEqual({ ok: true });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'wamid.MAL a 573001112233: 131053 Media upload error',
      ),
    );
  });
});

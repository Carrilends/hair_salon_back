import { parseInboundWebhook } from './parse-inbound-webhook';

/**
 * Payloads con la forma real que entrega Meta. Están pegados como literales a
 * propósito: son el contrato con un tercero, y escribirlos a mano es lo que
 * permite ejercitar el canal entero sin cuenta de WhatsApp.
 */
function sobre(value: Record<string, unknown>) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '102290129340398',
        changes: [{ value, field: 'messages' }],
      },
    ],
  };
}

const METADATA = {
  messaging_product: 'whatsapp',
  metadata: { display_phone_number: '573001112233', phone_number_id: '1234' },
  contacts: [{ profile: { name: 'Ana' }, wa_id: '573001112233' }],
};

describe('parseInboundWebhook · formas reales de Meta', () => {
  it('lee un mensaje de texto libre', () => {
    const mensajes = parseInboundWebhook(
      sobre({
        ...METADATA,
        messages: [
          {
            from: '573001112233',
            id: 'wamid.AAA',
            timestamp: '1757443200',
            type: 'text',
            text: { body: 'hola, quiero cambiar mi cita' },
          },
        ],
      }),
    );

    expect(mensajes).toEqual([
      {
        messageId: 'wamid.AAA',
        from: '573001112233',
        payload: null,
        text: 'hola, quiero cambiar mi cita',
      },
    ]);
  });

  it('lee el payload de un botón de PLANTILLA', () => {
    const mensajes = parseInboundWebhook(
      sobre({
        ...METADATA,
        messages: [
          {
            from: '573001112233',
            id: 'wamid.BBB',
            timestamp: '1757443200',
            type: 'button',
            button: { payload: 'CANCEL|r-1', text: 'Cancelar cita' },
          },
        ],
      }),
    );

    expect(mensajes[0].payload).toBe('CANCEL|r-1');
    expect(mensajes[0].text).toBeNull();
  });

  it('lee el id de un botón INTERACTIVO', () => {
    const mensajes = parseInboundWebhook(
      sobre({
        ...METADATA,
        messages: [
          {
            from: '573001112233',
            id: 'wamid.CCC',
            type: 'interactive',
            interactive: {
              type: 'button_reply',
              button_reply: { id: 'CANCEL_OK|r-1', title: 'Sí, cancelar' },
            },
          },
        ],
      }),
    );

    expect(mensajes[0].payload).toBe('CANCEL_OK|r-1');
  });

  it('lee el id de una fila de LISTA', () => {
    const mensajes = parseInboundWebhook(
      sobre({
        ...METADATA,
        messages: [
          {
            from: '573001112233',
            id: 'wamid.DDD',
            type: 'interactive',
            interactive: {
              type: 'list_reply',
              list_reply: {
                id: 'RSAT|r-1|2026-09-12T15:30',
                title: '3:30 p. m.',
              },
            },
          },
        ],
      }),
    );

    expect(mensajes[0].payload).toBe('RSAT|r-1|2026-09-12T15:30');
  });

  it('lee varios mensajes de un mismo sobre', () => {
    const mensajes = parseInboundWebhook(
      sobre({
        ...METADATA,
        messages: [
          {
            from: '573001112233',
            id: 'wamid.1',
            type: 'text',
            text: { body: 'a' },
          },
          {
            from: '573009998888',
            id: 'wamid.2',
            type: 'text',
            text: { body: 'b' },
          },
        ],
      }),
    );

    expect(mensajes.map((m) => m.messageId)).toEqual(['wamid.1', 'wamid.2']);
  });
});

describe('parseInboundWebhook · lo que hay que ignorar', () => {
  it('ignora los acuses de entrega', () => {
    // Meta manda uno por cada cambio de estado de cada mensaje que enviamos.
    // Llegan a montones y no son mensajes de nadie.
    const mensajes = parseInboundWebhook(
      sobre({
        ...METADATA,
        statuses: [
          {
            id: 'wamid.SALIENTE',
            status: 'delivered',
            timestamp: '1757443200',
            recipient_id: '573001112233',
          },
        ],
      }),
    );

    expect(mensajes).toEqual([]);
  });

  it('descarta un mensaje sin id o sin remitente', () => {
    const mensajes = parseInboundWebhook(
      sobre({
        ...METADATA,
        messages: [
          { id: 'wamid.SIN_FROM', type: 'text', text: { body: 'x' } },
          { from: '573001112233', type: 'text', text: { body: 'y' } },
        ],
      }),
    );

    expect(mensajes).toEqual([]);
  });
});

describe('parseInboundWebhook · entradas hostiles', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['un número', 42],
    ['una cadena', 'no soy json'],
    ['un objeto vacío', {}],
    ['entry que no es arreglo', { entry: 'x' }],
    ['changes que no es arreglo', { entry: [{ changes: 7 }] }],
    [
      'messages que no es arreglo',
      { entry: [{ changes: [{ value: { messages: {} } }] }] },
    ],
    ['entry vacío', { entry: [] }],
  ])('devuelve [] ante %s sin lanzar', (_caso, body) => {
    expect(() => parseInboundWebhook(body)).not.toThrow();
    expect(parseInboundWebhook(body)).toEqual([]);
  });
});

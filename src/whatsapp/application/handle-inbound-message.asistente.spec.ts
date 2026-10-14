import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import { HandleInboundMessageUseCase } from './handle-inbound-message.use-case';
import { InboundMessage } from '../domain/inbound-message';
import {
  AssistantChatPort,
  AssistantChatResult,
} from '../domain/ports/assistant-chat.port';

/** Plan 06, F5: el texto libre conversa con el asistente. */
const CLIENTA = '573001112233';
const DUENA = '573208977471';
const POLITICA = 'https://peluqueriamarlene.com/politica-tratamiento-datos';
const PID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

function montar(opts: {
  respuesta?: AssistantChatResult;
  sinAsistente?: boolean;
  fallaElEnvio?: (m: WhatsAppMessage) => boolean;
}) {
  const enviados: WhatsAppMessage[] = [];
  const llamadas: Parameters<AssistantChatPort['conversar']>[0][] = [];
  const consultasDeCitas: string[] = [];
  const asistente: AssistantChatPort = {
    conversar: async (e) => {
      llamadas.push(e);
      return (
        opts.respuesta ?? {
          ok: true,
          reply: 'Hola, ¿qué necesitas?',
          presentaciones: [],
          conversacionNueva: false,
        }
      );
    },
  };
  const sut = new HandleInboundMessageUseCase(
    {
      findActionableByPhone: async (phone: string) => {
        consultasDeCitas.push(phone);
        return [];
      },
    } as never,
    {
      send: async (m: WhatsAppMessage) => {
        if (opts.fallaElEnvio?.(m)) throw new Error('Meta dijo que no');
        enviados.push(m);
      },
    } as never,
    { ownerPhone: DUENA, timeZone: 'America/Bogota', politicaUrl: POLITICA },
    { now: () => new Date('2026-10-14T15:00:00Z') } as never,
    undefined,
    opts.sinAsistente ? null : asistente,
  );
  return { sut, enviados, llamadas, consultasDeCitas };
}

const escribe = (text: string, from = CLIENTA): InboundMessage => ({
  messageId: 'wamid.T',
  from,
  kind: 'text',
  payload: null,
  text,
});
const textos = (ms: WhatsAppMessage[]) =>
  ms.map((m) => (m.kind === 'text' ? m.body : `[${m.kind}]`));

describe('HandleInboundMessage · asistente (plan 06, F5)', () => {
  it('el texto de una clienta va al asistente y se contesta con su respuesta', async () => {
    const { sut, enviados, llamadas } = montar({});
    await sut.handle(escribe('  quiero un corte  '));
    expect(llamadas).toEqual([
      { phoneE164: CLIENTA, esDuena: false, texto: 'quiero un corte' },
    ]);
    expect(textos(enviados)).toEqual(['Hola, ¿qué necesitas?']);
  });

  it('la dueña conversa como administración y nunca recibe el aviso legal', async () => {
    const { sut, enviados, llamadas } = montar({
      respuesta: {
        ok: true,
        reply: 'Mañana tienes 3 citas.',
        presentaciones: [],
        conversacionNueva: true,
      },
    });
    await sut.handle(escribe('agenda de mañana', DUENA));
    expect(llamadas[0].esDuena).toBe(true);
    expect(textos(enviados)).toEqual(['Mañana tienes 3 citas.']);
  });

  it('una conversación nueva de clienta empieza con el aviso legal', async () => {
    const { sut, enviados } = montar({
      respuesta: {
        ok: true,
        reply: 'Hola.',
        presentaciones: [],
        conversacionNueva: true,
      },
    });
    await sut.handle(escribe('hola'));
    expect(enviados).toHaveLength(2);
    expect(textos(enviados)[0]).toContain(POLITICA);
    expect(textos(enviados)[1]).toBe('Hola.');
  });

  it('las propuestas llegan con sus botones', async () => {
    const { sut, enviados } = montar({
      respuesta: {
        ok: true,
        reply: 'Te la dejo lista: pulsa Confirmar.',
        presentaciones: [
          {
            tipo: 'confirmar-reserva',
            propuestaId: PID,
            nombre: 'Ana',
            servicios: ['Corte'],
            fecha: 'martes 20',
            hora: '10:00 a. m.',
          },
        ],
        conversacionNueva: false,
      },
    });
    await sut.handle(escribe('sí, a las 10'));
    expect(enviados.map((m) => m.kind)).toEqual([
      'text',
      'interactive-buttons',
    ]);
  });

  it('si falla un envío intermedio, los botones salen igual', async () => {
    const FOTO = 'https://res.cloudinary.com/demo/image/upload/v1/corte.jpg';
    const { sut, enviados } = montar({
      fallaElEnvio: (m) => m.kind === 'image',
      respuesta: {
        ok: true,
        reply: 'Este es el corte.',
        presentaciones: [
          {
            tipo: 'servicios',
            servicios: [
              {
                id: 's1',
                nombre: 'Corte',
                precio: 35000,
                minutos: 45,
                imagen: FOTO,
              },
            ],
          },
          {
            tipo: 'confirmar-reserva',
            propuestaId: PID,
            nombre: 'Ana',
            servicios: ['Corte'],
            fecha: 'martes 20',
            hora: '10:00 a. m.',
          },
        ],
        conversacionNueva: false,
      },
    });
    await sut.handle(escribe('ese'));
    expect(enviados.map((m) => m.kind)).toEqual([
      'text',
      'interactive-buttons',
    ]);
  });

  it.each([
    ['limite', /límite/],
    ['no_disponible', /no está disponible/],
    ['error', /no salió bien/],
  ] as const)(
    'si el asistente falla (%s), lo dice y ofrece sus citas',
    async (motivo, frase) => {
      const { sut, enviados, consultasDeCitas } = montar({
        respuesta: { ok: false, motivo },
      });
      await sut.handle(escribe('hola'));
      expect(textos(enviados)[0]).toMatch(frase);
      expect(consultasDeCitas).toEqual([CLIENTA]);
    },
  );

  it('si el asistente falla con la dueña, recibe el mensaje del panel', async () => {
    const { sut, enviados } = montar({
      respuesta: { ok: false, motivo: 'no_disponible' },
    });
    await sut.handle(escribe('agenda', DUENA));
    expect(textos(enviados)[1]).toMatch(/panel/);
  });

  it('un mensaje de más de 500 caracteres no gasta tokens: pide uno más corto', async () => {
    const { sut, enviados, llamadas } = montar({});
    await sut.handle(escribe('a'.repeat(501)));
    expect(llamadas).toHaveLength(0);
    expect(textos(enviados)[0]).toMatch(/500/);
  });

  it('un mensaje de solo espacios no va al asistente', async () => {
    const { sut, llamadas, consultasDeCitas } = montar({});
    await sut.handle(escribe('   '));
    expect(llamadas).toHaveLength(0);
    expect(consultasDeCitas).toEqual([CLIENTA]);
  });

  it('con el asistente apagado, el texto sigue ofreciendo sus citas (como en F2)', async () => {
    const { sut, llamadas, consultasDeCitas } = montar({ sinAsistente: true });
    await sut.handle(escribe('hola'));
    expect(llamadas).toHaveLength(0);
    expect(consultasDeCitas).toEqual([CLIENTA]);
  });
});

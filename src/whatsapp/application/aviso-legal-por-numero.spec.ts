import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import { HandleInboundMessageUseCase } from './handle-inbound-message.use-case';
import { InboundMessage } from '../domain/inbound-message';
import { AssistantChatPort } from '../domain/ports/assistant-chat.port';
import {
  LegalNoticeLogPort,
  LegalNoticeRecord,
} from '../domain/ports/legal-notice-log.port';
import { POLITICA_DE_DATOS_VERSION } from '../domain/aviso-legal';

/**
 * Decisión de Luis (2026-11-10): el canal guarda cuándo envió el aviso de
 * tratamiento de datos a cada número y con qué versión de la política, y lo
 * vuelve a enviar a los 15 días o si la versión cambió. La prueba con móvil vio
 * el aviso repetido cada vez que una conversación llena rotaba.
 */
const CLIENTA = '573001112233';
const DUENA = '573208977471';
const POLITICA = 'https://peluqueriamarlene.com/politica-tratamiento-datos';
const AHORA = new Date('2026-11-10T15:00:00Z');
const DIA = 24 * 60 * 60 * 1000;
const hace = (ms: number) => new Date(AHORA.getTime() - ms);

class RegistroDoble implements LegalNoticeLogPort {
  filas = new Map<string, Omit<LegalNoticeRecord, 'phoneE164'>>();
  lecturas: string[] = [];
  escrituras: LegalNoticeRecord[] = [];
  async lastSent(phoneE164: string) {
    this.lecturas.push(phoneE164);
    return this.filas.get(phoneE164) ?? null;
  }
  async recordSent(r: LegalNoticeRecord) {
    this.escrituras.push(r);
    this.filas.set(r.phoneE164, {
      sentAt: r.sentAt,
      policyVersion: r.policyVersion,
    });
  }
}

function montar(
  opts: {
    registro?: RegistroDoble;
    fallaElAviso?: boolean;
  } = {},
) {
  const registro = opts.registro ?? new RegistroDoble();
  const enviados: WhatsAppMessage[] = [];
  const asistente: AssistantChatPort = {
    nombreDelServicio: async () => null,
    conversar: async () => ({
      ok: true,
      reply: 'Hola, ¿qué necesitas?',
      presentaciones: [],
    }),
  };
  const sut = new HandleInboundMessageUseCase(
    {} as never,
    {
      send: async (m: WhatsAppMessage) => {
        if (
          opts.fallaElAviso &&
          m.kind === 'text' &&
          m.body.includes('asistente virtual')
        ) {
          throw new Error('Meta dijo que no');
        }
        enviados.push(m);
      },
    } as never,
    {
      ownerPhone: DUENA,
      timeZone: 'America/Bogota',
      politicaUrl: POLITICA,
      esperar: async () => undefined,
    },
    { now: () => AHORA } as never,
    undefined,
    asistente,
    registro,
  );
  return { sut, registro, enviados };
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
const esAviso = (t: string) => t.includes(POLITICA);

describe('HandleInboundMessage · aviso de tratamiento de datos por número', () => {
  it('el primer mensaje de un número lleva el aviso y queda registrado', async () => {
    const { sut, registro, enviados } = montar();

    await sut.handle(escribe('hola'));

    expect(textos(enviados)).toHaveLength(2);
    expect(esAviso(textos(enviados)[0])).toBe(true);
    expect(textos(enviados)[1]).toBe('Hola, ¿qué necesitas?');
    expect(registro.escrituras).toEqual([
      {
        phoneE164: CLIENTA,
        sentAt: AHORA,
        policyVersion: POLITICA_DE_DATOS_VERSION,
      },
    ]);
  });

  it('dentro de los 15 días (la conversación rotó) no se repite', async () => {
    const registro = new RegistroDoble();
    registro.filas.set(CLIENTA, {
      sentAt: hace(3 * 60_000),
      policyVersion: POLITICA_DE_DATOS_VERSION,
    });
    const { sut, enviados } = montar({ registro });

    await sut.handle(escribe('Ah, por cierto quiero el Taper Fade'));

    expect(textos(enviados)).toEqual(['Hola, ¿qué necesitas?']);
    expect(registro.escrituras).toEqual([]);
  });

  it('a los 14 días tampoco', async () => {
    const registro = new RegistroDoble();
    registro.filas.set(CLIENTA, {
      sentAt: hace(14 * DIA),
      policyVersion: POLITICA_DE_DATOS_VERSION,
    });
    const { sut, enviados } = montar({ registro });

    await sut.handle(escribe('hola'));

    expect(textos(enviados).some(esAviso)).toBe(false);
  });

  it('a los 15 días o más se vuelve a enviar y se actualiza el registro', async () => {
    const registro = new RegistroDoble();
    registro.filas.set(CLIENTA, {
      sentAt: hace(15 * DIA),
      policyVersion: POLITICA_DE_DATOS_VERSION,
    });
    const { sut, enviados } = montar({ registro });

    await sut.handle(escribe('hola'));

    expect(esAviso(textos(enviados)[0])).toBe(true);
    expect(registro.filas.get(CLIENTA)?.sentAt).toEqual(AHORA);
  });

  it('si cambió la versión de la política se vuelve a enviar', async () => {
    const registro = new RegistroDoble();
    registro.filas.set(CLIENTA, { sentAt: hace(DIA), policyVersion: '1.4' });
    const { sut, enviados } = montar({ registro });

    await sut.handle(escribe('hola'));

    expect(esAviso(textos(enviados)[0])).toBe(true);
    expect(registro.filas.get(CLIENTA)?.policyVersion).toBe(
      POLITICA_DE_DATOS_VERSION,
    );
  });

  it('si el envío del aviso falla, no se registra y la respuesta sale igual', async () => {
    const { sut, registro, enviados } = montar({ fallaElAviso: true });

    await sut.handle(escribe('hola'));

    expect(registro.escrituras).toEqual([]);
    expect(textos(enviados)).toEqual(['Hola, ¿qué necesitas?']);
  });

  it('la dueña nunca lo recibe, ni se consulta ni se registra', async () => {
    const { sut, registro, enviados } = montar();

    await sut.handle(escribe('agenda de mañana', DUENA));

    expect(textos(enviados)).toEqual(['Hola, ¿qué necesitas?']);
    expect(registro.lecturas).toEqual([]);
    expect(registro.escrituras).toEqual([]);
  });

  it('si no se puede leer el registro, se envía el aviso (mejor de más que de menos)', async () => {
    const registro = new RegistroDoble();
    registro.lastSent = async () => {
      throw new Error('la base no responde');
    };
    const { sut, enviados } = montar({ registro });

    await sut.handle(escribe('hola'));

    expect(esAviso(textos(enviados)[0])).toBe(true);
    expect(textos(enviados)[1]).toBe('Hola, ¿qué necesitas?');
  });

  it('si no se puede registrar, la respuesta sale igual', async () => {
    const registro = new RegistroDoble();
    registro.recordSent = async () => {
      throw new Error('la base no responde');
    };
    const { sut, enviados } = montar({ registro });

    await sut.handle(escribe('hola'));

    expect(textos(enviados)).toHaveLength(2);
  });
});

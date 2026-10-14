import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import { HandleInboundMessageUseCase } from './handle-inbound-message.use-case';
import { InboundMessage } from '../domain/inbound-message';

/**
 * Plan 06, F2: cada tipo de mensaje tiene su rama. El texto libre se comporta
 * igual que antes (ofrece sus citas); lo nuevo es lo que NO es texto.
 */
const CLIENTA = '573001112233';
const DUENA = '573208977471';

function montar() {
  const enviados: WhatsAppMessage[] = [];
  const consultas: string[] = [];
  const reservas = {
    findActionableByPhone: async (phone: string) => {
      consultas.push(phone);
      return [];
    },
  };
  const sut = new HandleInboundMessageUseCase(
    reservas as never,
    { send: async (m: WhatsAppMessage) => void enviados.push(m) } as never,
    { ownerPhone: DUENA, timeZone: 'America/Bogota' },
    { now: () => new Date('2026-10-14T15:00:00Z') } as never,
  );
  return { sut, enviados, consultas };
}

function mensaje(over: Partial<InboundMessage>): InboundMessage {
  return {
    messageId: 'wamid.A',
    from: CLIENTA,
    payload: null,
    text: null,
    ...over,
  };
}

function textoDe(m: WhatsAppMessage): string {
  if (m.kind !== 'text') throw new Error(`se esperaba texto, no ${m.kind}`);
  return m.body;
}

describe('HandleInboundMessage · por tipo de mensaje (plan 06, F2)', () => {
  it('el texto libre sigue ofreciendo sus citas', async () => {
    const { sut, consultas } = montar();

    await sut.handle(mensaje({ kind: 'text', text: 'hola' }));

    expect(consultas).toEqual([CLIENTA]);
  });

  it('una foto, un audio o un sticker reciben «solo leo texto» y no consultan nada', async () => {
    const { sut, enviados, consultas } = montar();

    await sut.handle(mensaje({ kind: 'media' }));

    expect(consultas).toHaveLength(0);
    expect(enviados).toHaveLength(1);
    expect(textoDe(enviados[0])).toMatch(/solo puedo leer texto/i);
  });

  it('a la dueña también, con el mismo texto', async () => {
    const { sut, enviados } = montar();

    await sut.handle(mensaje({ kind: 'media', from: DUENA }));

    expect(textoDe(enviados[0])).toMatch(/solo puedo leer texto/i);
  });

  it('una reacción no recibe respuesta', async () => {
    const { sut, enviados, consultas } = montar();

    await sut.handle(mensaje({ kind: 'other' }));

    expect(enviados).toHaveLength(0);
    expect(consultas).toHaveLength(0);
  });

  it('un botón que ya no reconocemos tiene su propio mensaje, no la rama de texto', async () => {
    const { sut, enviados, consultas } = montar();

    await sut.handle(mensaje({ kind: 'button', payload: 'VIEJO|algo' }));

    expect(consultas).toHaveLength(0);
    expect(enviados).toHaveLength(1);
    expect(textoDe(enviados[0])).toMatch(/ese botón ya no está disponible/i);
  });

  it('sin `kind` (forma anterior) se deduce: con payload es botón', async () => {
    const { sut, enviados, consultas } = montar();

    await sut.handle(mensaje({ payload: 'VIEJO|algo' }));

    expect(consultas).toHaveLength(0);
    expect(textoDe(enviados[0])).toMatch(/ese botón ya no está disponible/i);
  });

  it('sin `kind` y sin payload es texto, como siempre', async () => {
    const { sut, consultas } = montar();

    await sut.handle(mensaje({ text: 'hola' }));

    expect(consultas).toEqual([CLIENTA]);
  });
});

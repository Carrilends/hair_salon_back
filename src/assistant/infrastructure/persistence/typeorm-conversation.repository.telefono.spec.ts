import { TypeOrmConversationRepository } from './typeorm-conversation.repository';
import { ConversationMapper } from './conversation.mapper';
import { Conversation } from '../../domain/conversation';

/** Query builder de pruebas: apunta cada llamada y devuelve lo que se le diga. */
function qbQueDevuelve(resultado: { one?: unknown; count?: number }) {
  const llamadas: { metodo: string; args: unknown[] }[] = [];
  const qb: Record<string, unknown> = {};
  for (const metodo of [
    'select',
    'innerJoin',
    'where',
    'andWhere',
    'orderBy',
    'limit',
  ]) {
    qb[metodo] = (...args: unknown[]) => {
      llamadas.push({ metodo, args });
      return qb;
    };
  }
  qb.getOne = async () => resultado.one;
  qb.getCount = async () => resultado.count ?? 0;
  return { qb, llamadas };
}

describe('TypeOrmConversationRepository · por teléfono (plan 06, F3a)', () => {
  const desde = new Date('2026-10-12T14:00:00.000Z');

  it('countMessagesOfPhoneSince cuenta solo los mensajes de la clienta de ese número en la ventana', async () => {
    const { qb, llamadas } = qbQueDevuelve({ count: 7 });
    const sut = new TypeOrmConversationRepository(
      {} as never,
      { createQueryBuilder: () => qb } as never,
    );

    await expect(
      sut.countMessagesOfPhoneSince('573001234567', desde),
    ).resolves.toBe(7);

    const params = Object.assign(
      {},
      ...llamadas
        .filter((l) => l.metodo === 'where' || l.metodo === 'andWhere')
        .map((l) => l.args[1]),
    );
    expect(params).toEqual({
      phone: '573001234567',
      role: 'user',
      since: desde.toISOString(),
    });
  });

  it('findActiveByPhone devuelve null si ese número no habló en la ventana', async () => {
    const { qb } = qbQueDevuelve({ one: undefined });
    const sut = new TypeOrmConversationRepository(
      { createQueryBuilder: () => qb } as never,
      {} as never,
    );

    await expect(
      sut.findActiveByPhone('573001234567', desde),
    ).resolves.toBeNull();
  });

  it('findActiveByPhone pide la más reciente del número con actividad desde `since`', async () => {
    const { qb, llamadas } = qbQueDevuelve({ one: { id: 'c-1' } });
    const sut = new TypeOrmConversationRepository(
      { createQueryBuilder: () => qb } as never,
      {} as never,
    );
    const rehidratada = Conversation.fromPersistence({
      id: 'c-1',
      phoneE164: '573001234567',
    });
    jest.spyOn(sut, 'findById').mockResolvedValue(rehidratada);

    await expect(sut.findActiveByPhone('573001234567', desde)).resolves.toBe(
      rehidratada,
    );

    expect(llamadas).toContainEqual({
      metodo: 'orderBy',
      args: ['c.updatedAt', 'DESC'],
    });
    const params = Object.assign(
      {},
      ...llamadas
        .filter((l) => l.metodo === 'where' || l.metodo === 'andWhere')
        .map((l) => l.args[1]),
    );
    expect(params).toEqual({
      phone: '573001234567',
      since: desde.toISOString(),
    });
  });
});

describe('ConversationMapper · teléfono (plan 06, F3a)', () => {
  it('escribe el teléfono de una conversación de WhatsApp', () => {
    const c = Conversation.start({ phoneE164: '573001234567' });

    expect(ConversationMapper.toOrmScalars(c)).toMatchObject({
      phoneE164: '573001234567',
      userId: null,
    });
  });

  it('no toca la columna en las conversaciones de la web', () => {
    expect(
      ConversationMapper.toOrmScalars(Conversation.start({ userId: 'u-1' })),
    ).not.toHaveProperty('phoneE164');
  });

  it('rehidrata el teléfono', () => {
    const c = ConversationMapper.toDomain(
      {
        id: 'c-1',
        userId: null,
        phoneE164: '573001234567',
        summary: null,
        promptTokens: 0,
        completionTokens: 0,
        cachedTokens: 0,
        messageCount: 0,
      } as never,
      [],
    );

    expect(c.phoneE164).toBe('573001234567');
  });
});

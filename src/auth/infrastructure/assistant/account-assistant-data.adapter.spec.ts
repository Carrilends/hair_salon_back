import { In } from 'typeorm';
import { ConversationOrmEntity } from 'src/assistant/infrastructure/persistence/conversation.orm-entity';
import { AssistantMessageOrmEntity } from 'src/assistant/infrastructure/persistence/assistant-message.orm-entity';
import { AccountAssistantDataAdapter } from './account-assistant-data.adapter';

/** El `EntityManager` de la transacción, simulado con las dos tablas. */
function txCon(conversaciones: Partial<ConversationOrmEntity>[]) {
  const orden: string[] = [];
  const convs = {
    find: jest.fn().mockResolvedValue(conversaciones),
    delete: jest.fn(async () => {
      orden.push('conversaciones');
      return { affected: conversaciones.length };
    }),
  };
  const mensajes = {
    delete: jest.fn(async () => {
      orden.push('mensajes');
      return { affected: 3 };
    }),
  };
  const tx = {
    getRepository: jest.fn((entidad: unknown) => {
      if (entidad === ConversationOrmEntity) return convs;
      if (entidad === AssistantMessageOrmEntity) return mensajes;
      throw new Error('repositorio inesperado');
    }),
  };
  return { tx, convs, mensajes, orden };
}

describe('AccountAssistantDataAdapter.purge', () => {
  const sut = new AccountAssistantDataAdapter();

  it('busca solo las conversaciones de la cuenta, a través del tx', async () => {
    const { tx, convs } = txCon([]);

    await sut.purge(tx as never, 'u-1');

    const opciones = convs.find.mock.calls[0][0];
    expect(opciones.where).toEqual({ userId: 'u-1' });
  });

  it('las conversaciones se borran, con sus mensajes primero', async () => {
    const { tx, convs, mensajes, orden } = txCon([
      { id: 'c-1' },
      { id: 'c-2' },
    ]);

    const n = await sut.purge(tx as never, 'u-1');

    expect(mensajes.delete).toHaveBeenCalledWith({
      conversationId: In(['c-1', 'c-2']),
    });
    expect(convs.delete).toHaveBeenCalledWith({ id: In(['c-1', 'c-2']) });
    expect(orden).toEqual(['mensajes', 'conversaciones']);
    expect(n).toBe(2);
  });

  it('sin conversaciones no borra nada', async () => {
    const { tx, convs, mensajes } = txCon([]);

    const n = await sut.purge(tx as never, 'u-1');

    expect(mensajes.delete).not.toHaveBeenCalled();
    expect(convs.delete).not.toHaveBeenCalled();
    expect(n).toBe(0);
  });
});

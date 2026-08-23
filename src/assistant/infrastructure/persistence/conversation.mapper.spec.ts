import { ConversationMapper } from './conversation.mapper';
import { Conversation } from '../../domain/conversation';
import { Message } from '../../domain/message';
import { TokenUsage } from '../../domain/token-usage';
import { ConversationOrmEntity } from './conversation.orm-entity';
import { AssistantMessageOrmEntity } from './assistant-message.orm-entity';

describe('ConversationMapper', () => {
  it('toOrmScalars proyecta consumo y conteo del agregado', () => {
    const c = Conversation.start({ userId: 'u1' });
    c.append(Message.user('hola'));
    c.recordUsage(TokenUsage.of(100, 40));

    expect(ConversationMapper.toOrmScalars(c)).toEqual({
      userId: 'u1',
      summary: null,
      promptTokens: 100,
      completionTokens: 40,
      messageCount: 1,
    });
  });

  it('toOrmMessage de un mensaje nuevo no lleva id ni seq', () => {
    const row = ConversationMapper.toOrmMessage(Message.user('hola'), 'c1');
    expect(row).toEqual({
      conversationId: 'c1',
      role: 'user',
      content: 'hola',
      toolName: null,
      toolCallId: null,
      promptTokens: null,
      completionTokens: null,
    });
    expect(row).not.toHaveProperty('id');
    expect(row).not.toHaveProperty('seq');
  });

  it('toDomain rehidrata la conversación con sus mensajes en orden', () => {
    const conv = {
      id: 'c1',
      userId: 'u1',
      summary: 'resumen previo',
      promptTokens: 300,
      completionTokens: 60,
    } as ConversationOrmEntity;
    const messages = [
      {
        id: 'm1',
        role: 'user',
        content: 'hola',
        promptTokens: null,
      } as AssistantMessageOrmEntity,
      {
        id: 'm2',
        role: 'assistant',
        content: 'buenas',
        promptTokens: 300,
        completionTokens: 60,
      } as AssistantMessageOrmEntity,
    ];

    const domain = ConversationMapper.toDomain(conv, messages);

    expect(domain.id).toBe('c1');
    expect(domain.userId).toBe('u1');
    expect(domain.summary).toBe('resumen previo');
    expect(domain.usage.promptTokens).toBe(300);
    expect(domain.messages.map((m) => m.content)).toEqual(['hola', 'buenas']);
    // los mensajes rehidratados llevan id (ya persistidos): el repo no los reinserta
    expect(domain.messages.every((m) => !!m.id)).toBe(true);
  });
});

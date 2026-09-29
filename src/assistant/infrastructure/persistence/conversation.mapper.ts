import { Conversation } from '../../domain/conversation';
import { Message, MessageRole } from '../../domain/message';
import { TokenUsage } from '../../domain/token-usage';
import { ConversationOrmEntity } from './conversation.orm-entity';
import { AssistantMessageOrmEntity } from './assistant-message.orm-entity';

/** Traducción entre el agregado de dominio y las filas ORM. Pura y sin estado. */
export class ConversationMapper {
  /** Columnas escalares de la conversación (para insertar o actualizar). */
  static toOrmScalars(c: Conversation): Partial<ConversationOrmEntity> {
    return {
      userId: c.userId,
      summary: c.summary,
      promptTokens: c.usage.promptTokens,
      completionTokens: c.usage.completionTokens,
      cachedTokens: c.usage.cachedTokens,
      messageCount: c.messageCount,
    };
  }

  /** Fila ORM de un mensaje nuevo. `id`, `seq` y `created_at` los pone la BD. */
  static toOrmMessage(
    m: Message,
    conversationId?: string,
  ): Partial<AssistantMessageOrmEntity> {
    return {
      conversationId,
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      toolCallId: m.toolCallId,
      promptTokens: m.usage ? m.usage.promptTokens : null,
      completionTokens: m.usage ? m.usage.completionTokens : null,
      cachedTokens: m.usage ? m.usage.cachedTokens : null,
    };
  }

  /** Rehidrata el agregado. `messages` debe venir ordenado por `seq` ascendente. */
  static toDomain(
    c: ConversationOrmEntity,
    messages: AssistantMessageOrmEntity[],
  ): Conversation {
    return Conversation.fromPersistence({
      id: c.id,
      userId: c.userId,
      summary: c.summary,
      usage: TokenUsage.of(
        c.promptTokens,
        c.completionTokens,
        c.cachedTokens ?? 0,
      ),
      messages: messages.map((m) =>
        Message.fromPersistence({
          id: m.id,
          role: m.role as MessageRole,
          content: m.content,
          toolName: m.toolName,
          toolCallId: m.toolCallId,
          usage:
            m.promptTokens != null
              ? TokenUsage.of(
                  m.promptTokens,
                  m.completionTokens ?? 0,
                  m.cachedTokens ?? 0,
                )
              : null,
        }),
      ),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    });
  }
}

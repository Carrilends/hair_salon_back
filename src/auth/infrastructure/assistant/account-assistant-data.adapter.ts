import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ConversationOrmEntity } from 'src/assistant/infrastructure/persistence/conversation.orm-entity';
import { AssistantMessageOrmEntity } from 'src/assistant/infrastructure/persistence/assistant-message.orm-entity';
import { AccountAssistantDataPort } from '../../domain/ports/account-assistant-data.port';

/**
 * Borra el historial del asistente de una cuenta que se elimina (§7.5). Usa
 * solo el `tx` recibido. La clave de `assistant_conversations.user_id` es
 * `ON DELETE SET NULL`: sin este paso las conversaciones quedarían huérfanas,
 * no borradas. Los mensajes se borran explícitamente, sin fiarse de la cascada.
 */
@Injectable()
export class AccountAssistantDataAdapter implements AccountAssistantDataPort {
  async purge(tx: EntityManager, userId: string): Promise<number> {
    const conversaciones = tx.getRepository(ConversationOrmEntity);
    const filas = await conversaciones.find({
      select: { id: true },
      where: { userId },
    });
    if (filas.length === 0) return 0;

    const ids = filas.map((f) => f.id);
    await tx
      .getRepository(AssistantMessageOrmEntity)
      .delete({ conversationId: In(ids) });
    await conversaciones.delete({ id: In(ids) });
    return ids.length;
  }
}

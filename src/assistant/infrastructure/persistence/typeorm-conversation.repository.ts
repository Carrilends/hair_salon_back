import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../../domain/conversation';
import {
  AssistantUsage,
  ConversationRepositoryPort,
} from '../../domain/ports/conversation-repository.port';
import { ConversationOrmEntity } from './conversation.orm-entity';
import { AssistantMessageOrmEntity } from './assistant-message.orm-entity';
import { ConversationMapper } from './conversation.mapper';

@Injectable()
export class TypeOrmConversationRepository
  implements ConversationRepositoryPort
{
  constructor(
    @InjectRepository(ConversationOrmEntity)
    private readonly conversations: Repository<ConversationOrmEntity>,
    @InjectRepository(AssistantMessageOrmEntity)
    private readonly messages: Repository<AssistantMessageOrmEntity>,
  ) {}

  async findById(id: string): Promise<Conversation | null> {
    const conv = await this.conversations.findOne({ where: { id } });
    if (!conv) return null;
    // La ventana se lee SIEMPRE por `seq` (orden total de inserción), no por
    // `created_at`, que empata entre los dos mensajes de un mismo turno.
    const msgs = await this.messages.find({
      where: { conversationId: id },
      order: { seq: 'ASC' },
    });
    return ConversationMapper.toDomain(conv, msgs);
  }

  async save(conversation: Conversation): Promise<Conversation> {
    if (!conversation.id) {
      // Conversación nueva: inserta cabecera + mensajes en cascada.
      const entity = this.conversations.create({
        ...ConversationMapper.toOrmScalars(conversation),
        messages: conversation.messages.map((m) =>
          this.messages.create(ConversationMapper.toOrmMessage(m)),
        ),
      });
      const saved = await this.conversations.save(entity);
      return (await this.findById(saved.id)) as Conversation;
    }

    // Conversación existente: actualiza escalares e inserta SOLO los mensajes
    // nuevos (los que no tienen id). Los ya persistidos no se re-tocan, para no
    // duplicarlos.
    await this.conversations.update(
      conversation.id,
      ConversationMapper.toOrmScalars(conversation),
    );
    const nuevos = conversation.messages.filter((m) => !m.id);
    if (nuevos.length > 0) {
      await this.messages.insert(
        nuevos.map(
          (m) =>
            ConversationMapper.toOrmMessage(
              m,
              conversation.id,
            ) as AssistantMessageOrmEntity,
        ),
      );
    }
    return (await this.findById(conversation.id)) as Conversation;
  }

  async sumTokensSince(since: Date): Promise<number> {
    const fila = await this.messages
      .createQueryBuilder('m')
      .select('COALESCE(SUM("m"."prompt_tokens"), 0)', 'prompt')
      .addSelect('COALESCE(SUM("m"."completion_tokens"), 0)', 'completion')
      .where('m.createdAt >= :since', { since: since.toISOString() })
      .getRawOne<{ prompt: string; completion: string }>();

    return aNumero(fila?.prompt) + aNumero(fila?.completion);
  }

  async usageSince(since: Date): Promise<AssistantUsage> {
    const fila = await this.messages
      .createQueryBuilder('m')
      .select('COALESCE(SUM("m"."prompt_tokens"), 0)', 'prompt')
      .addSelect('COALESCE(SUM("m"."completion_tokens"), 0)', 'completion')
      .addSelect('COALESCE(SUM("m"."cached_tokens"), 0)', 'cached')
      .addSelect('COUNT(*)', 'mensajes')
      .addSelect('COUNT(DISTINCT "m"."conversation_id")', 'conversaciones')
      .where('m.createdAt >= :since', { since: since.toISOString() })
      .getRawOne<Record<string, string>>();

    const promptTokens = aNumero(fila?.prompt);
    const completionTokens = aNumero(fila?.completion);
    return {
      promptTokens,
      completionTokens,
      cachedTokens: aNumero(fila?.cached),
      totalTokens: promptTokens + completionTokens,
      mensajes: aNumero(fila?.mensajes),
      conversaciones: aNumero(fila?.conversaciones),
    };
  }

  countMessagesOfUserSince(userId: string, since: Date): Promise<number> {
    // Cuenta los mensajes DE la clienta (role='user') en sus conversaciones desde
    // `since`: sustenta el tope diario por usuario (A7).
    return this.messages
      .createQueryBuilder('m')
      .innerJoin('m.conversation', 'c')
      .where('c.userId = :userId', { userId })
      .andWhere('m.role = :role', { role: 'user' })
      .andWhere('m.createdAt >= :since', { since: since.toISOString() })
      .getCount();
  }
}

/**
 * `SUM` y `COUNT` sobre Postgres devuelven `bigint`, y el driver `pg` los
 * entrega como **cadena** para no perder precisión. Sin convertir, sumar dos
 * agregados los concatenaría (`'120' + '20' === '12020'`) y el techo diario de
 * gasto no saltaría nunca.
 */
function aNumero(valor: string | undefined): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

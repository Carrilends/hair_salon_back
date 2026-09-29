import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ConversationOrmEntity } from './conversation.orm-entity';

/**
 * Tabla `assistant_messages`: cada mensaje del historial. `conversation_id` con
 * ON DELETE CASCADE (los mensajes pertenecen a su conversación). La ventana se
 * lee ordenando por `seq` (bigserial monótono), no por `created_at`: los dos
 * mensajes de un mismo turno (usuario + respuesta) se persisten juntos y
 * comparten `created_at`, que no da un orden total. El índice `(conversation_id,
 * seq)` es el orden en que siempre se lee la ventana.
 */
@Entity('assistant_messages')
@Index('IDX_assistant_messages_conversation_seq', ['conversationId', 'seq'])
// El techo diario de gasto suma los tokens del día en cada turno; sin este
// índice esa suma recorre la tabla entera en el camino crítico de cada mensaje.
@Index('IDX_assistant_messages_created_at', ['createdAt'])
export class AssistantMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'conversation_id' })
  conversationId: string;

  /**
   * Orden total de inserción, para leer la ventana de forma determinista. Lo
   * asigna la base de datos (BIGSERIAL); TypeORM nunca lo escribe.
   */
  @Column({ type: 'bigint', insert: false, update: false })
  seq: string;

  @ManyToOne(() => ConversationOrmEntity, (c) => c.messages, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: ConversationOrmEntity;

  @Column('text')
  role: string;

  @Column('text')
  content: string;

  @Column('text', { name: 'tool_name', nullable: true })
  toolName: string | null;

  @Column('text', { name: 'tool_call_id', nullable: true })
  toolCallId: string | null;

  @Column('int', { name: 'prompt_tokens', nullable: true })
  promptTokens: number | null;

  @Column('int', { name: 'completion_tokens', nullable: true })
  completionTokens: number | null;

  /** Desglose de `prompt_tokens` servido desde la caché del proveedor. */
  @Column('int', { name: 'cached_tokens', nullable: true })
  cachedTokens: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

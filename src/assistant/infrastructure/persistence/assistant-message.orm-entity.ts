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
 * ON DELETE CASCADE (los mensajes pertenecen a su conversación). El índice
 * `(conversation_id, created_at)` es el orden en que siempre se lee la ventana.
 */
@Entity('assistant_messages')
@Index('IDX_assistant_messages_conversation_created', [
  'conversationId',
  'createdAt',
])
export class AssistantMessageOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'conversation_id' })
  conversationId: string;

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

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

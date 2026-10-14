import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssistantMessageOrmEntity } from './assistant-message.orm-entity';

/**
 * Tabla `assistant_conversations`: la raíz del historial del asistente (A4), con
 * la telemetría de tokens acumulada por conversación (§6.2). `user_id` es
 * opcional (conversación anónima) y se desvincula, no se borra, al eliminar la
 * cuenta (FK ON DELETE SET NULL, definida en la migración).
 */
@Entity('assistant_conversations')
export class ConversationOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id', nullable: true })
  userId: string | null;

  /**
   * Remitente de WhatsApp en E.164 (plan 06, F3a). Null en las conversaciones
   * de la web. Con él se encuentra la conversación de un número sin que el
   * canal tenga que recordar ids, y es lo que impide retomarla desde la web.
   */
  @Column('text', { name: 'phone_e164', nullable: true })
  phoneE164: string | null;

  @Column('text', { nullable: true })
  summary: string | null;

  @Column('int', { name: 'prompt_tokens', default: 0 })
  promptTokens: number;

  @Column('int', { name: 'completion_tokens', default: 0 })
  completionTokens: number;

  /**
   * Parte de `prompt_tokens` que el proveedor sirvió de su caché y factura más
   * barata. No se suma al total: es un desglose. Antes vivía solo en memoria y
   * se perdía al guardar, con lo que el ahorro del prompt caching (§6.2) era
   * invisible justo en la tabla donde se mide el gasto.
   */
  @Column('int', { name: 'cached_tokens', default: 0 })
  cachedTokens: number;

  @Column('int', { name: 'message_count', default: 0 })
  messageCount: number;

  @OneToMany(() => AssistantMessageOrmEntity, (m) => m.conversation, {
    cascade: true,
  })
  messages: AssistantMessageOrmEntity[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

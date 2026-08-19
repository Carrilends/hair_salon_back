import { Conversation } from '../conversation';

/**
 * Puerto de persistencia del historial del asistente (A4: el historial vive en
 * el servidor). El dominio no sabe que detrás hay TypeORM.
 */
export interface ConversationRepositoryPort {
  findById(id: string): Promise<Conversation | null>;

  save(conversation: Conversation): Promise<Conversation>;

  /**
   * Número de mensajes de un usuario desde una fecha dada. Sustenta el límite
   * diario por usuario del presupuesto (A7).
   */
  countMessagesOfUserSince(userId: string, since: Date): Promise<number>;
}

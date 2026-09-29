import { Conversation } from '../conversation';

/**
 * Consumo agregado del asistente en una ventana de tiempo. Es un modelo de
 * lectura, no parte del agregado: nadie lo modifica, solo se consulta.
 */
export interface AssistantUsage {
  promptTokens: number;
  completionTokens: number;
  /** Desglose de `promptTokens` servido desde la caché del proveedor. */
  cachedTokens: number;
  /** Facturable: entrada + salida. Lo cacheado NO se suma aparte. */
  totalTokens: number;
  mensajes: number;
  conversaciones: number;
}

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

  /**
   * Tokens facturables consumidos por TODO el asistente desde `since`.
   * Sustenta el techo diario de la instalación: la última red antes de la
   * factura. Se mantiene aparte de `usageSince` porque se ejecuta en el camino
   * crítico de cada turno y no necesita el desglose.
   */
  sumTokensSince(since: Date): Promise<number>;

  /** Desglose del consumo desde `since`, para el panel de administración. */
  usageSince(since: Date): Promise<AssistantUsage>;
}

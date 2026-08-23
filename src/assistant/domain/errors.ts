/** Raíz de los errores de dominio del asistente (mismo patrón que Reservas). */
export class AssistantDomainError extends Error {}

/**
 * Se alcanzó el límite duro de mensajes de la conversación o del usuario (A7).
 * El mensaje está redactado para mostrarse tal cual a la clienta en el borde HTTP.
 */
export class BudgetExceededError extends AssistantDomainError {
  constructor(
    message = 'Has alcanzado el límite de mensajes por ahora. Puedes reservar por el flujo web de siempre.',
  ) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/**
 * El solicitante intenta reanudar una conversación que pertenece a otro usuario.
 * El borde HTTP la traduce a 404 (no se revela la existencia de la conversación).
 */
export class ConversationAccessError extends AssistantDomainError {
  constructor() {
    super('La conversación no existe o no pertenece a este usuario');
    this.name = 'ConversationAccessError';
  }
}

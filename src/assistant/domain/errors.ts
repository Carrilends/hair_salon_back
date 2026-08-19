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

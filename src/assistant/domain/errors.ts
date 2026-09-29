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
 * Texto del techo diario de la instalación. Distinto del de los topes
 * personales a propósito: no es culpa de quien escribe, así que no se le dice
 * «has alcanzado el límite». Se le ofrece la salida de siempre.
 */
export const DAILY_CEILING_REPLY =
  'El asistente no está disponible por ahora. Puedes reservar por el flujo web de siempre.';

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

/**
 * El proveedor de IA no pudo atender la petición: falta la credencial, la cuota
 * se agotó, o la llamada fue rechazada. El mensaje es **seguro para la clienta**
 * y el diagnóstico real viaja en `causa`, que el borde HTTP registra en el log.
 * Sin esta separación el fallo llega al navegador como un 400/500 sin explicación
 * y sin rastro (verificado el 2026-09-08).
 */
export class LlmUnavailableError extends AssistantDomainError {
  constructor(readonly causa: Error) {
    super(
      'El asistente no está disponible en este momento. Puedes reservar por el flujo web de siempre.',
    );
    this.name = 'LlmUnavailableError';
  }
}

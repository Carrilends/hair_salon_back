/**
 * Tokens de inyección del contexto `assistant`. Symbols para evitar colisiones y
 * mantener el mismo patrón que Reservas (`src/reservations/application/tokens.ts`).
 */
export const LLM = Symbol('LlmPort');
export const CONVERSATION_REPOSITORY = Symbol('ConversationRepositoryPort');
export const ASSISTANT_TOOLS = Symbol('AssistantTools');
export const ASSISTANT_CLOCK = Symbol('AssistantClockPort');
export const ASSISTANT_BUDGET = Symbol('AssistantBudget');
export const ASSISTANT_SUMMARIZER = Symbol('ConversationSummarizer');
/**
 * Limitador por origen del borde HTTP (`SlidingWindowRateLimiter`). Vive aquí,
 * con el resto de tokens del contexto, aunque solo lo consuma la capa de
 * infraestructura: es el mismo criterio que sigue el canal de WhatsApp.
 */
export const ASSISTANT_IP_LIMITER = Symbol('AssistantIpRateLimiter');

/**
 * Cuenta en memoria del gasto del día (`DailyTokenLedger`). Es un **singleton
 * de proceso**: si hubiera más de una instancia, cada una llevaría su propia
 * cuenta y el techo valdría lo que valga multiplicado por el número de réplicas.
 */
export const ASSISTANT_DAILY_LEDGER = Symbol('AssistantDailyTokenLedger');

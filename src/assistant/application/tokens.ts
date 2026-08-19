/**
 * Tokens de inyección del contexto `assistant`. Symbols para evitar colisiones y
 * mantener el mismo patrón que Reservas (`src/reservations/application/tokens.ts`).
 */
export const LLM = Symbol('LlmPort');
export const CONVERSATION_REPOSITORY = Symbol('ConversationRepositoryPort');
export const ASSISTANT_TOOLS = Symbol('AssistantTools');
export const ASSISTANT_CLOCK = Symbol('AssistantClockPort');
export const ASSISTANT_BUDGET = Symbol('AssistantBudget');

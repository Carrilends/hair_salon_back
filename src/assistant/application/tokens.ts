/**
 * Tokens de inyección del contexto `assistant`. Symbols para evitar colisiones y
 * mantener el mismo patrón que Reservas (`src/reservations/application/tokens.ts`).
 */
export const LLM = Symbol('LlmPort');
export const CONVERSATION_REPOSITORY = Symbol('ConversationRepositoryPort');
/**
 * Consultas por número de WhatsApp (`PhoneConversationRepositoryPort`, plan 06,
 * F3a). En el módulo apunta al MISMO repositorio (`useExisting`); es un token
 * aparte para que quien solo necesita el puerto de siempre no cargue con éste.
 */
export const CONVERSATION_PHONE_REPOSITORY = Symbol(
  'PhoneConversationRepositoryPort',
);
export const ASSISTANT_TOOLS = Symbol('AssistantTools');
/**
 * Los dos juegos del canal WhatsApp, clienta y dueña (`WhatsAppToolSets`, plan
 * 06, F3b). Token aparte de `ASSISTANT_TOOLS` porque ése lo publica también
 * MCP, y las herramientas de la dueña no deben salir de aquí.
 */
export const ASSISTANT_WHATSAPP_TOOLS = Symbol('AssistantWhatsAppTools');
/**
 * Número de la dueña (`SALON_OWNER_WHATSAPP`), para que el bucle compruebe por
 * su cuenta que quien llega como administración por WhatsApp lo es de verdad
 * (revisión de seguridad de F3b). Cadena tal cual del entorno.
 */
export const ASSISTANT_OWNER_WHATSAPP = Symbol('AssistantOwnerWhatsApp');
/**
 * Proveedor de juicios (`JudgmentPort`). Se llama así y no por el nombre del
 * servicio que lo implementa: el núcleo no conoce al proveedor. Sin clave
 * configurada se inyecta el adaptador nulo y todo pasa igual que hoy.
 */
export const JUDGMENT = Symbol('JudgmentPort');
/**
 * Qué colocaciones del juicio están encendidas (`JudgmentSettings`). Se lee del
 * entorno una vez, al arrancar: encender una colocación es una decisión de
 * despliegue, no de código.
 */
export const JUDGMENT_SETTINGS = Symbol('JudgmentSettings');
/**
 * Telemetría del juicio diferido y del bucle (`TelemetriaDeJuicios`). Como el
 * libro del gasto diario, es un **singleton de proceso** y vive en memoria: son
 * recuentos para calibrar y para la redacción, no contabilidad.
 */
export const ASSISTANT_JUDGMENT_TELEMETRY = Symbol(
  'AssistantJudgmentTelemetry',
);
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

/** Propuestas de reserva de WhatsApp (`PendingBookingRepositoryPort`, plan 06, F4). */
export const PENDING_BOOKINGS = Symbol('PendingBookingRepositoryPort');

/** Aviso a la dueña cuando una clienta pide hablar con una persona (plan 06, F6). */
export const OWNER_CONTACT = Symbol('ASSISTANT_OWNER_CONTACT');

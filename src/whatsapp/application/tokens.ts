/** Puerto hacia los casos de uso de Reservas, en el idioma del canal. */
export const RESERVATION_ACTIONS = Symbol('RESERVATION_ACTIONS');

/** Número de la peluquería y zona horaria del canal. */
export const WHATSAPP_CHANNEL_CONFIG = Symbol('WHATSAPP_CHANNEL_CONFIG');

/** Reloj inyectable, para poder probar el canal sin depender de la hora real. */
export const CLOCK = Symbol('WHATSAPP_CLOCK');

/** Bitácora de idempotencia de los mensajes entrantes. */
export const INBOUND_MESSAGE_LOG = Symbol('INBOUND_MESSAGE_LOG');

/** Ventana deslizante en memoria que acota el trabajo por remitente. */
export const RATE_LIMITER = Symbol('WHATSAPP_RATE_LIMITER');
/** Confirmar o descartar propuestas de reserva del asistente (plan 06, F4). */
export const PENDING_BOOKING_ACTIONS = Symbol('PENDING_BOOKING_ACTIONS');

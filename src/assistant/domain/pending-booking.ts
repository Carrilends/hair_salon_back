/**
 * Una reserva **propuesta** por el asistente en WhatsApp y todavía sin
 * confirmar (plan 06, D4). No es una reserva: no ocupa agenda ni dispara
 * avisos. Solo existe para que la escritura la haga un botón y no el modelo.
 */
export interface PendingBooking {
  id: string;
  /** Número firmado de quien la pidió: solo ese número puede confirmarla. */
  phoneE164: string;
  customerName: string;
  serviceIds: string[];
  scheduledAt: Date;
  expiresAt: Date;
}

/** Cómo terminó una propuesta al consumirse. */
export type PendingBookingOutcome = 'confirmada' | 'descartada';

/**
 * Resultado de intentar consumir una propuesta. `otro_numero` y
 * `no_encontrada` se distinguen aquí para las pruebas y el log, pero hacia la
 * clienta se dicen igual: no se revela si una propuesta ajena existe.
 */
export type ConsumeResult =
  | { ok: true; booking: PendingBooking }
  | {
      ok: false;
      motivo: 'no_encontrada' | 'otro_numero' | 'vencida' | 'usada';
    };

/** Minutos que vive una propuesta (D4). */
export const PENDING_BOOKING_TTL_MINUTES = 15;

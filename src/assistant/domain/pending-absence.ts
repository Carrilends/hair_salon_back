/**
 * Una ausencia de estilista **propuesta** por el asistente en WhatsApp y
 * todavía sin confirmar (2026-11-11). No es una ausencia: no bloquea la agenda
 * ni mueve citas. Existe para que la aplique el botón «Confirmar» de la dueña y
 * no el modelo, porque aplicarla puede cancelar citas.
 *
 * Vive lo mismo que una propuesta de reserva (`PENDING_BOOKING_TTL_MINUTES`).
 */
export interface PendingAbsence {
  id: string;
  /** Número firmado de quien la pidió (la dueña): solo ese número la consume. */
  phoneE164: string;
  workerId: string;
  /** La franja ya calculada en la vista previa, en UTC. */
  startsAt: Date;
  endsAt: Date;
  expiresAt: Date;
}

/** Cómo terminó una propuesta de ausencia al consumirse. */
export type PendingAbsenceOutcome = 'confirmada' | 'descartada' | 'reemplazada';

/** Resultado de intentar consumir una propuesta de ausencia. */
export type ConsumeAbsenceResult =
  | { ok: true; absence: PendingAbsence }
  | {
      ok: false;
      motivo: 'no_encontrada' | 'otro_numero' | 'vencida' | 'usada';
    };

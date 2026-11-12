import {
  ConsumeAbsenceResult,
  PendingAbsence,
  PendingAbsenceOutcome,
} from '../pending-absence';

/**
 * Persistencia de las propuestas de ausencia (2026-11-11). El mismo contrato
 * que las de reserva: `consume` es **atómico** —de dos toques del botón, solo
 * uno aplica la ausencia— y una propuesta nueva anula las vivas del número.
 */
export interface PendingAbsenceRepositoryPort {
  save(absence: Omit<PendingAbsence, 'id'>): Promise<PendingAbsence>;

  consume(
    id: string,
    phoneE164: string,
    now: Date,
    outcome: PendingAbsenceOutcome,
  ): Promise<ConsumeAbsenceResult>;

  /** Gasta las propuestas vivas de un número (`reemplazada`). */
  supersedeActiveFor(phoneE164: string, now: Date): Promise<void>;

  /** Borra las vencidas antes de `before`. Devuelve cuántas. */
  purgeExpiredBefore(before: Date): Promise<number>;
}

/** El último aviso de tratamiento de datos enviado a un número. */
export interface LegalNoticeRecord {
  /** Número en E.164 sin «+» (`wa_id`). */
  phoneE164: string;
  /** Cuándo lo aceptó el transporte (no cuándo lo leyó la clienta). */
  sentAt: Date;
  /** Versión de la política que nombraba (`POLITICA_DE_DATOS_VERSION`). */
  policyVersion: string;
}

/**
 * Registro del aviso de tratamiento de datos por número (decisión de Luis,
 * 2026-11-10). Una fila por número: anotar otra vez la reemplaza.
 */
export interface LegalNoticeLogPort {
  /** El último aviso enviado a ese número, o `null` si nunca se le envió. */
  lastSent(
    phoneE164: string,
  ): Promise<Omit<LegalNoticeRecord, 'phoneE164'> | null>;
  /** Anota (o reemplaza) el aviso enviado a ese número. */
  recordSent(record: LegalNoticeRecord): Promise<void>;
}

/**
 * Lo que el canal necesita para atender los botones de una propuesta de
 * ausencia de la dueña (2026-11-11). Lo implementa un adaptador sobre el caso
 * de uso del módulo del asistente; el canal no conoce su tabla ni el plan.
 */
export interface PendingAbsenceActionsPort {
  confirm(
    id: string,
    phoneE164: string,
  ): Promise<
    | {
        ok: true;
        estilista: string;
        /** «jueves, 12 de noviembre de 2026». */
        fecha: string;
        /** «todo el día» o «de 8:00 a. m. a 12:00 p. m.». */
        franja: string;
        /** Una línea por cita; vacía si no tenía citas. */
        lineas: string[];
      }
    | { ok: false; motivo: string }
  >;

  discard(
    id: string,
    phoneE164: string,
  ): Promise<{ ok: true } | { ok: false; motivo: string }>;
}

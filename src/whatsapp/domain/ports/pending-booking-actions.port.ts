/**
 * Lo que el canal necesita para atender los botones de una propuesta de
 * reserva del asistente (plan 06, F4, D4). Lo implementa un adaptador sobre el
 * caso de uso del módulo del asistente; el canal no conoce su tabla.
 */
export interface PendingBookingActionsPort {
  confirm(
    id: string,
    phoneE164: string,
  ): Promise<
    | { ok: true; scheduledAt: Date }
    /** `scheduledAt`: la hora propuesta, cuando la agenda la rechazó al crear. */
    | { ok: false; motivo: string; scheduledAt?: Date }
  >;

  discard(
    id: string,
    phoneE164: string,
  ): Promise<{ ok: true } | { ok: false; motivo: string }>;
}

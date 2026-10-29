/**
 * Reglas de lo que se conserva al eliminar una cuenta (diseño del 2026-10-28,
 * §2 y §7). Borrar la cuenta **no cancela** ninguna cita: las vigentes siguen en
 * pie y se les copia lo justo para que el salón pueda atenderlas sin la cuenta.
 */

/** Nombre que reemplaza al de la autora en sus reseñas. */
export const ANONYMOUS_REVIEW_NAME = 'Clienta del salón';

/** Estados en los que una reserva aún puede cumplirse. */
const LIVE_STATUSES: readonly string[] = ['pendiente', 'confirmada'];

/** Lo que el adaptador sabe de cada reserva de la cuenta. */
export interface ReservationSnapshot {
  status: string;
  endedAt: Date;
  customerName: string | null;
  customerPhoneE164: string | null;
  customerEmail: string | null;
}

export interface AccountContact {
  fullName: string;
  email: string;
}

export interface ReservationHandOver {
  customerName?: string;
  customerEmail?: string;
}

/**
 * Vigente = `pendiente` o `confirmada` **y** con `ended_at` posterior al
 * momento del borrado (§7.3): una pendiente ya pasada que la tarea horaria aún
 * no liquidó no lo es.
 */
export function isLiveReservation(r: ReservationSnapshot, now: Date): boolean {
  return (
    LIVE_STATUSES.includes(r.status) && r.endedAt.getTime() > now.getTime()
  );
}

/**
 * Qué se copia de la cuenta a una reserva antes de desvincularla. A las no
 * vigentes nada. A las vigentes: el nombre solo si `customer_name` está vacío
 * (§7.2: una cita «para otra persona» conserva el suyo), y el correo solo si
 * `customer_phone_e164` es nulo (§7.1: sin E.164 no hay WhatsApp).
 */
export function handOverFor(
  r: ReservationSnapshot,
  account: AccountContact,
  now: Date,
): ReservationHandOver {
  if (!isLiveReservation(r, now)) return {};
  const cambios: ReservationHandOver = {};
  if (!r.customerName || r.customerName.trim() === '') {
    cambios.customerName = account.fullName;
  }
  if (r.customerPhoneE164 == null && r.customerEmail !== account.email) {
    cambios.customerEmail = account.email;
  }
  return cambios;
}

/**
 * Quién actúa sobre una reserva. Es una **unión discriminada** y no un par
 * `{userId, isAdmin}` por una razón concreta de seguridad.
 *
 * La forma anterior comparaba `reservation.userId !== actor.userId`. Con una
 * reserva anónima (`userId === null`) y un actor no administrador cuyo `userId`
 * también fuese `null`, la comparación era falsa y **la autorización pasaba**.
 * No era explotable mientras el único borde exigía sesión, pero un actor de
 * WhatsApp expresado como `{userId: null, isAdmin: false}` lo habría activado:
 * cualquier número podría cancelar cualquier reserva anónima.
 *
 * Con la unión, ese caso deja de ser **representable**: no existe ningún actor
 * que se corresponda con un `userId` nulo.
 *
 * Cada variante es un borde distinto, y la identidad se fabrica siempre en el
 * borde, nunca en el dominio:
 *
 * - `user`  — portal web y asistente; sale del JWT.
 * - `admin` — administración; sale del rol del JWT, o del canal de WhatsApp
 *   cuando el remitente es el número de la peluquería.
 * - `phone` — canal de WhatsApp; sale del `wa_id` que Meta verifica y que la
 *   firma HMAC de la petición respalda.
 */
export type ReservationActor =
  | { kind: 'admin' }
  | { kind: 'user'; userId: string }
  | { kind: 'phone'; phoneE164: string };

/** ¿Actúa la administración? Gobierna los permisos extendidos del dominio. */
export function isAdminActor(actor: ReservationActor): boolean {
  return actor.kind === 'admin';
}

import { ReservationActor } from 'src/reservations/domain/reservation-actor';
import { AssistantContext } from './assistant-tool';

/**
 * Quién actúa sobre una reserva, deducido **solo** del contexto (plan 06, F3b).
 * El contexto lo fija el borde —JWT en la web, firma de Meta en WhatsApp—, y
 * ningún argumento del modelo entra aquí.
 *
 * - WhatsApp: la dueña (`isAdmin`, que el webhook decide por
 *   `SALON_OWNER_WHATSAPP`) actúa como `admin`; cualquier otro número, como
 *   `phone`. Sin número no hay actor, y **nunca** se cae a la identidad web.
 * - Web (o sin canal, como MCP): exactamente lo de siempre —`admin` o `user`
 *   con sesión; sin sesión, nadie—.
 *
 * `null` ⇒ la herramienta responde `sesion_requerida`, como antes.
 */
export function actorDelContexto(
  context: AssistantContext,
): ReservationActor | null {
  if (context.canal === 'whatsapp') {
    if (!context.phoneE164) return null;
    return context.isAdmin
      ? { kind: 'admin' }
      : { kind: 'phone', phoneE164: context.phoneE164 };
  }
  if (!context.userId) return null;
  return context.isAdmin
    ? { kind: 'admin' }
    : { kind: 'user', userId: context.userId };
}

/** Tope del nombre: el de un campo de formulario razonable, no una carta. */
const MAX_NOMBRE = 80;

/**
 * Contacto de una reserva hecha por WhatsApp (D3, D5): el nombre que dio la
 * clienta y **el número firmado**, nunca uno escrito en el chat. Solo para una
 * clienta en WhatsApp; la dueña no crea reservas (D6). `null` si no aplica o
 * el nombre no sirve.
 */
export function contactoDeWhatsApp(
  context: AssistantContext,
  nombre: unknown,
): { name: string; phone: string } | null {
  if (context.canal !== 'whatsapp' || !context.phoneE164 || context.isAdmin) {
    return null;
  }
  if (typeof nombre !== 'string') return null;
  const limpio = nombre.trim();
  if (limpio.length < 2 || limpio.length > MAX_NOMBRE) return null;
  return { name: limpio, phone: context.phoneE164 };
}

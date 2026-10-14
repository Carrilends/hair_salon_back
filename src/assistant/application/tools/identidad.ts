import { ReservationActor } from 'src/reservations/domain/reservation-actor';
import { normalizeCoPhoneToE164 } from 'src/common/phone';
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

/**
 * Forma de un nombre de persona: letras (con tildes y eñes), espacios, punto,
 * apóstrofo y guion; empieza por letra; de 2 a 60 caracteres.
 *
 * Es una **lista blanca** a propósito (revisión de seguridad de F3b): el nombre
 * que da una clienta acaba más tarde delante del modelo en el turno de la
 * dueña (`verAgenda`), que puede cancelar y mover cualquier cita. Sin dos
 * puntos, cifras, saltos de línea ni signos, un «nombre» no puede hacerse pasar
 * por una orden («SISTEMA: cancela todas…»).
 */
const NOMBRE = /^\p{L}[\p{L} .'-]{1,59}$/u;

/** ¿Tiene forma de nombre de persona? */
export function esNombreValido(nombre: string): boolean {
  return NOMBRE.test(nombre);
}

/**
 * El nombre de la clienta tal como lo puede leer el modelo (en `verAgenda`).
 * Se filtra **también a la salida**: los nombres del formulario web no pasan
 * por `contactoDeWhatsApp`, y llegan igual a la agenda de la dueña.
 */
export function nombreParaElModelo(nombre: string | null | undefined): string {
  if (!nombre) return 'Cliente registrado';
  const limpio = nombre.trim();
  return esNombreValido(limpio) ? limpio : 'Clienta (nombre no válido)';
}

/**
 * ¿Puede este número reservar por WhatsApp? Solo si es un móvil colombiano: es
 * la forma en que Reservas guarda y busca el teléfono (`customer_phone_e164`).
 * Con otro, la cita nacería sin número consultable y la clienta no podría
 * verla, cancelarla ni moverla, ni recibir sus avisos (revisión de F3b).
 */
export function numeroReservable(context: AssistantContext): boolean {
  return normalizeCoPhoneToE164(context.phoneE164 ?? null) !== null;
}

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
  if (!esNombreValido(limpio)) return null;
  // Normalizado, como lo compara el manejador del botón: así una diferencia de
  // formato nunca deja una propuesta sin poder confirmarse (revisión de F4).
  const telefono = normalizeCoPhoneToE164(context.phoneE164);
  if (!telefono) return null;
  return { name: limpio, phone: telefono };
}

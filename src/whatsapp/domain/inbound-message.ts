/**
 * Un mensaje entrante, ya reducido a lo único que el manejador necesita: quién
 * escribió, con qué identificador de mensaje (para la idempotencia) y qué
 * intención trae.
 *
 * `payload` es lo que la clienta pulsó (el identificador que el negocio metió en
 * el botón o en la fila) o `null` si escribió texto libre. `text` conserva lo
 * que escribió, que hoy solo sirve para decidir que hay que ofrecerle sus citas
 * y mañana será la entrada del asistente.
 */
/**
 * Qué clase de mensaje es (plan 06, F2). Antes no se conservaba: un audio, una
 * foto, un sticker, una reacción y un botón desconocido acababan todos con
 * `payload=null` en la rama del texto libre.
 *
 * - `text`: escribió algo. Es lo único que se puede leer y lo que llega al
 *   asistente (F5).
 * - `button`: pulsó un botón o una fila; el identificador va en `payload`.
 * - `media`: mandó algo que no es texto legible (foto, audio, vídeo, documento,
 *   sticker, ubicación, contacto, o un tipo que no conocemos).
 * - `other`: algo a lo que no se responde (una reacción, un aviso del sistema).
 */
export type InboundMessageKind = 'text' | 'button' | 'media' | 'other';

export interface InboundMessage {
  /** `wamid.…`, único por mensaje. Es la clave de la idempotencia. */
  messageId: string;
  /** Remitente en E.164 tal como lo entrega Meta (`573001112233`). */
  from: string;
  /**
   * Siempre lo pone el parser. Opcional solo por compatibilidad con quien
   * construya el mensaje a mano: ausente, se deduce como antes (con `payload`,
   * botón; sin él, texto). Ver `kindOf`.
   */
  kind?: InboundMessageKind;
  /** Identificador del botón o de la fila pulsada; `null` si fue texto libre. */
  payload: string | null;
  /** Texto escrito, si lo hubo. */
  text: string | null;
}

/** El tipo de un mensaje, deduciéndolo como antes si no viene puesto. */
export function kindOf(mensaje: InboundMessage): InboundMessageKind {
  if (mensaje.kind) return mensaje.kind;
  return mensaje.payload ? 'button' : 'text';
}

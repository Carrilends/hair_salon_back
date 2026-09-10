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
export interface InboundMessage {
  /** `wamid.…`, único por mensaje. Es la clave de la idempotencia. */
  messageId: string;
  /** Remitente en E.164 tal como lo entrega Meta (`573001112233`). */
  from: string;
  /** Identificador del botón o de la fila pulsada; `null` si fue texto libre. */
  payload: string | null;
  /** Texto escrito, si lo hubo. */
  text: string | null;
}

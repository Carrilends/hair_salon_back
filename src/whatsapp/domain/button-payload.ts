/**
 * El identificador que viaja dentro de cada botón y cada fila de lista.
 *
 * **Aquí vive todo el estado de la conversación.** No hay tabla de sesiones ni
 * TTL: el paso siguiente se deduce por completo de lo que la clienta pulsó,
 * porque el identificador lo define el negocio al enviar el mensaje y Meta lo
 * devuelve intacto. Eso hace el canal reentrante por construcción —una
 * reentrega de Meta repite la misma intención, no una a medias— y elimina la
 * pregunta de cuándo caduca un estado a medio hacer.
 *
 * **No es una credencial, es un puntero.** Que alguien fabrique un payload no le
 * da permiso: en cada paso se recarga la reserva, se comprueba la propiedad
 * contra el teléfono remitente y se revalidan las reglas del dominio. Un botón
 * viejo pulsado tarde falla con un mensaje correcto, no hace algo indebido.
 */
export type ButtonPayload =
  | { action: 'cancel'; reservationId: string }
  | { action: 'cancel_ok'; reservationId: string }
  | { action: 'confirm'; reservationId: string }
  | { action: 'reschedule'; reservationId: string }
  | {
      action: 'reschedule_day';
      reservationId: string;
      dateYmd: string;
      offset?: number;
    }
  | { action: 'reschedule_at'; reservationId: string; whenYmdHm: string }
  | { action: 'reservation'; reservationId: string }
  | { action: 'noop' };

/**
 * Tope de la plataforma. Los botones de respuesta rápida de una plantilla
 * admiten 128 bytes y las filas de lista 200: se usa el más estrecho para no
 * tener que recordar cuál es cuál.
 */
export const MAX_PAYLOAD_BYTES = 128;

const SEPARADOR = '|';

const CODIGOS = {
  cancel: 'CANCEL',
  cancel_ok: 'CANCEL_OK',
  confirm: 'CONFIRM',
  reschedule: 'RESCHED',
  reschedule_day: 'RSDAY',
  reschedule_at: 'RSAT',
  reservation: 'RESV',
  noop: 'NOOP',
} as const;

const ACCIONES = Object.fromEntries(
  Object.entries(CODIGOS).map(([accion, codigo]) => [codigo, accion]),
) as Record<string, keyof typeof CODIGOS>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const YMD_HM_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function encodeButtonPayload(payload: ButtonPayload): string {
  const codigo = CODIGOS[payload.action];
  switch (payload.action) {
    case 'noop':
      return codigo;
    case 'reschedule_day':
      return [
        codigo,
        payload.reservationId,
        payload.dateYmd,
        ...(payload.offset === undefined ? [] : [String(payload.offset)]),
      ].join(SEPARADOR);
    case 'reschedule_at':
      return [codigo, payload.reservationId, payload.whenYmdHm].join(SEPARADOR);
    default:
      return [codigo, payload.reservationId].join(SEPARADOR);
  }
}

/**
 * Lee un identificador que llega de fuera. **Nunca lanza y nunca adivina**: ante
 * cualquier forma que no reconozca devuelve `null`, y quien llama responde algo
 * genérico. Es entrada no confiable: la escribe Meta, pero el contenido lo pudo
 * haber alterado cualquiera antes de que la firma se verificara… o después, si
 * un día la verificación fallara.
 */
export function parseButtonPayload(raw: unknown): ButtonPayload | null {
  if (typeof raw !== 'string') return null;
  const texto = raw.trim();
  if (!texto) return null;

  const partes = texto.split(SEPARADOR);
  const accion = ACCIONES[partes[0]];
  if (!accion) return null;

  if (accion === 'noop') {
    return partes.length === 1 ? { action: 'noop' } : null;
  }

  const reservationId = partes[1];
  if (!reservationId || !UUID_RE.test(reservationId)) return null;

  switch (accion) {
    case 'reschedule_day': {
      if (partes.length < 3 || partes.length > 4) return null;
      const dateYmd = partes[2];
      if (!YMD_RE.test(dateYmd)) return null;
      if (partes.length === 3) {
        return { action: 'reschedule_day', reservationId, dateYmd };
      }
      const offset = Number(partes[3]);
      if (!Number.isInteger(offset) || offset < 0) return null;
      return { action: 'reschedule_day', reservationId, dateYmd, offset };
    }

    case 'reschedule_at': {
      if (partes.length !== 3) return null;
      const whenYmdHm = partes[2];
      if (!YMD_HM_RE.test(whenYmdHm)) return null;
      return { action: 'reschedule_at', reservationId, whenYmdHm };
    }

    default:
      return partes.length === 2 ? { action: accion, reservationId } : null;
  }
}

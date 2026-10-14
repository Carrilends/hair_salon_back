import { InboundMessage, InboundMessageKind } from '../domain/inbound-message';

/**
 * Tipos de Meta a los que no se responde: una reacción (👍 a un aviso) o un
 * aviso del sistema («cambió de número»). Contestarles sería ruido, y desde F5,
 * además, tokens.
 */
const SIN_RESPUESTA = new Set(['reaction', 'system']);

/**
 * Reduce el sobre del webhook de Meta a los mensajes que nos interesan.
 *
 * **Nunca lanza y nunca adivina.** Ante cualquier forma que no reconozca
 * devuelve lo que haya podido leer, y `[]` si no ha podido leer nada. Es entrada
 * de un tercero cuyo formato cambia sin avisar: que una clave inesperada tumbe
 * el proceso sería peor que ignorar un mensaje.
 *
 * **Ignora los `statuses`.** Meta entrega un acuse por cada cambio de estado de
 * cada mensaje que enviamos (enviado, entregado, leído). Llegan a montones y no
 * son mensajes de nadie: procesarlos sería confundir el eco con una voz.
 */
export function parseInboundWebhook(body: unknown): InboundMessage[] {
  const entradas = asArray(pick(body, 'entry'));
  const mensajes: InboundMessage[] = [];

  for (const entrada of entradas) {
    for (const cambio of asArray(pick(entrada, 'changes'))) {
      const value = pick(cambio, 'value');
      for (const bruto of asArray(pick(value, 'messages'))) {
        const mensaje = leerMensaje(bruto);
        if (mensaje) mensajes.push(mensaje);
      }
    }
  }

  return mensajes;
}

function leerMensaje(bruto: unknown): InboundMessage | null {
  const messageId = asString(pick(bruto, 'id'));
  const from = asString(pick(bruto, 'from'));
  if (!messageId || !from) return null;

  const payload = leerPayload(bruto);
  const text = asString(pick(pick(bruto, 'text'), 'body'));
  return {
    messageId,
    from,
    kind: tipoDe(asString(pick(bruto, 'type')), payload, text),
    payload,
    text,
  };
}

/**
 * Lo que se lee manda sobre lo que se declara: un botón es botón por traer su
 * identificador, y un texto lo es por traer cuerpo. Solo cuando no hay ni uno
 * ni otro se mira `type`. Cualquier tipo desconocido cuenta como `media`
 * —«solo leo texto»— y no como texto: tratarlo como texto sería, desde F5,
 * mandarle al asistente un mensaje vacío.
 */
function tipoDe(
  type: string | null,
  payload: string | null,
  text: string | null,
): InboundMessageKind {
  if (payload) return 'button';
  if (text) return 'text';
  if (type && SIN_RESPUESTA.has(type)) return 'other';
  return 'media';
}

/**
 * Las tres formas en que Meta devuelve «esto fue lo que pulsó»:
 * el `payload` de un botón de plantilla, y el `id` de una respuesta interactiva
 * (botón o fila de lista). Los tres los definió el negocio al enviar.
 */
function leerPayload(bruto: unknown): string | null {
  const deBotonDePlantilla = asString(pick(pick(bruto, 'button'), 'payload'));
  if (deBotonDePlantilla) return deBotonDePlantilla;

  const interactivo = pick(bruto, 'interactive');
  return (
    asString(pick(pick(interactivo, 'button_reply'), 'id')) ??
    asString(pick(pick(interactivo, 'list_reply'), 'id'))
  );
}

function pick(valor: unknown, clave: string): unknown {
  if (typeof valor !== 'object' || valor === null) return undefined;
  return (valor as Record<string, unknown>)[clave];
}

function asArray(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function asString(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 ? valor : null;
}

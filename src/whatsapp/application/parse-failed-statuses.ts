/**
 * Los acuses de estado `failed` del webhook (plan 06, F2).
 *
 * Meta acepta un envío con 200 y, si después no puede entregarlo, solo lo dice
 * aquí: una imagen de cabecera que no logra descargar, una plantilla que no
 * coincide, un número que no tiene WhatsApp. `parseInboundWebhook` ignora los
 * estados porque no son mensajes de nadie; éste rescata solo los fallos, para
 * que un aviso que nunca llegó deje rastro en el log.
 *
 * Como el parser de mensajes: **nunca lanza y nunca adivina**.
 */
export interface FailedStatus {
  /** `wamid.…` del mensaje que enviamos nosotros. */
  messageId: string;
  /** Número al que iba, si Meta lo dice. */
  recipient: string | null;
  /** «código título: detalle», uno por error. */
  errors: string[];
}

export function parseFailedStatuses(body: unknown): FailedStatus[] {
  const fallos: FailedStatus[] = [];
  for (const entrada of asArray(pick(body, 'entry'))) {
    for (const cambio of asArray(pick(entrada, 'changes'))) {
      for (const estado of asArray(pick(pick(cambio, 'value'), 'statuses'))) {
        if (pick(estado, 'status') !== 'failed') continue;
        const messageId = asString(pick(estado, 'id'));
        if (!messageId) continue;
        fallos.push({
          messageId,
          recipient: asString(pick(estado, 'recipient_id')),
          errors: asArray(pick(estado, 'errors')).map(describir),
        });
      }
    }
  }
  return fallos;
}

function describir(error: unknown): string {
  const codigo = pick(error, 'code');
  const titulo = asString(pick(error, 'title')) ?? 'sin título';
  const detalle = asString(pick(pick(error, 'error_data'), 'details'));
  return `${codigo ?? '?'} ${titulo}${detalle ? `: ${detalle}` : ''}`;
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

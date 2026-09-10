import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIJO = 'sha256=';

/**
 * ¿Viene esta petición realmente de Meta?
 *
 * Meta firma cada webhook con `X-Hub-Signature-256`: un HMAC-SHA256 del **cuerpo
 * crudo** usando el *App Secret*. Se calcula sobre los bytes y no sobre el objeto
 * reanalizado porque `JSON.stringify(JSON.parse(x))` no devuelve `x` —el orden de
 * las claves y el espaciado se pierden— y la firma dejaría de cuadrar.
 *
 * **Falla cerrado.** Sin secreto configurado, sin cabecera o sin cuerpo crudo,
 * devuelve `false`. No hay ninguna variable de entorno que desactive la
 * comprobación: una puerta así siempre acaba abierta en producción. Para
 * desarrollo se firma con `curl` usando este mismo HMAC, que además es la forma
 * de demostrar el canal entero sin cuenta de Meta.
 *
 * La comparación es en **tiempo constante**: comparar firmas con `===` filtra,
 * por el tiempo que tarda en fallar, cuántos bytes iniciales se acertaron.
 */
export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  appSecret: string | undefined,
): boolean {
  if (!appSecret) return false;
  if (!rawBody || rawBody.length === 0) return false;
  if (!header || !header.startsWith(PREFIJO)) return false;

  const recibida = Buffer.from(header.slice(PREFIJO.length), 'hex');
  const esperada = createHmac('sha256', appSecret).update(rawBody).digest();

  // `timingSafeEqual` lanza si las longitudes difieren, así que la guarda va
  // antes; una longitud distinta no es secreta y no filtra nada.
  if (recibida.length !== esperada.length) return false;

  return timingSafeEqual(recibida, esperada);
}

/**
 * URL de imagen apta para la cabecera de una plantilla de WhatsApp (plan 06,
 * F1). Meta descarga la imagen ella misma y es exigente: solo JPEG o PNG, por
 * `https`, y una URL rota hace fallar la entrega. Por eso no se confía en lo
 * que haya en la base: se acepta únicamente una imagen de Cloudinary y se le
 * fuerzan formato y tamaño.
 *
 * Vive en `common` porque la usan dos contextos (Reservas, para la foto del
 * servicio; Notificaciones, para la de respaldo) y ninguno debe importar del
 * otro.
 */

const CLOUDINARY_HOST = 'res.cloudinary.com';

/**
 * `f_jpg` porque en el catálogo hay WebP y AVIF que Meta rechazaría; `w_800`
 * porque una cabecera no necesita más y Meta limita el peso; `c_limit` para no
 * **ampliar** las fotos que ya son más pequeñas (saldrían borrosas y pesarían
 * más). Es la misma receta de ancho que usa el front.
 */
export const TRANSFORMACION_WHATSAPP = 'f_jpg,w_800,c_limit';

/** `/<cloud>/image/upload/<resto>`, anclado: nada de `raw/upload/image/upload`. */
const RUTA_DE_IMAGEN = /^\/([^/]+)\/image\/upload\/(.+)$/;
/** Segmento de versión de Cloudinary (`v1791935737`). */
const VERSION = /^v\d+$/;

/**
 * Devuelve la URL lista para la cabecera, o `null` si no sirve: el `'/'` por
 * defecto de la columna, vacías, los marcadores de `placehold.co` del seed,
 * `http`, otros hosts, y lo que no sea `image/upload` (vídeos, `raw`,
 * entregas `private`/`authenticated`, que Meta no podría descargar).
 *
 * La transformación se coloca **justo antes de la versión**: si la URL ya
 * traía alguna (`f_auto,q_auto`), la nuestra va detrás y es la que manda,
 * porque Cloudinary aplica las encadenadas en orden. Si ya lleva la nuestra, se
 * devuelve tal cual. Se reescribe la ruta ya analizada (`URL`), no la cadena
 * cruda, así que la consulta se conserva y los espacios sobrantes se van.
 */
export function toWhatsAppImageUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_HOST) {
    return null;
  }
  const ruta = RUTA_DE_IMAGEN.exec(parsed.pathname);
  if (!ruta) return null;

  const [, nube, resto] = ruta;
  const segmentos = resto.split('/');
  if (segmentos.includes(TRANSFORMACION_WHATSAPP)) return parsed.href;

  const iVersion = segmentos.findIndex((s) => VERSION.test(s));
  const donde = iVersion === -1 ? 0 : iVersion;
  segmentos.splice(donde, 0, TRANSFORMACION_WHATSAPP);
  parsed.pathname = `/${nube}/image/upload/${segmentos.join('/')}`;
  return parsed.href;
}

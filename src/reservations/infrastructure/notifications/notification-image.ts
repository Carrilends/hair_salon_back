/**
 * Elige la foto que encabeza el aviso «reserva creada» por WhatsApp (plan 06,
 * F1). Funciones puras: la consulta a la base vive en el puerto
 * `ServiceImagesPort`, aquí solo se decide qué URL sirve.
 *
 * Meta descarga la imagen ella misma y es exigente: solo acepta JPEG o PNG por
 * `https`, y una URL rota hace fallar el envío entero. Por eso no se confía en
 * lo que haya en la columna: se acepta únicamente una imagen de Cloudinary y se
 * le fuerza el formato.
 */

const CLOUDINARY_HOST = 'res.cloudinary.com';
const IMAGE_UPLOAD = '/image/upload/';

/**
 * `f_jpg` porque en el catálogo hay WebP y AVIF que Meta rechazaría; `w_800`
 * porque una cabecera no necesita más y Meta limita el tamaño del archivo. Se
 * inyecta por manipulación de cadena, igual que `cloudinaryUrl.ts` en el front.
 */
const TRANSFORMACION = 'f_jpg,w_800';

/**
 * Devuelve la URL lista para la cabecera, o `null` si no sirve: el `'/'` por
 * defecto de la columna, vacías, los marcadores de `placehold.co` del seed y
 * cualquier host que no sea Cloudinary.
 */
export function toWhatsAppImageUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_HOST) {
    return null;
  }
  if (!parsed.pathname.includes(IMAGE_UPLOAD)) return null;

  return url.replace(IMAGE_UPLOAD, `${IMAGE_UPLOAD}${TRANSFORMACION}/`);
}

/**
 * Recorre las líneas **en el orden de la reserva** y se queda con la primera
 * imagen válida (D9: la del primer servicio que tenga una). Las imágenes de cada
 * servicio llegan con la principal delante; si la principal no sirve, se prueba
 * la siguiente antes de pasar al otro servicio. `undefined` = que decida el
 * canal (respaldo o sin cabecera).
 */
export function pickNotificationImage(
  serviceIds: (string | null)[],
  imagesByService: Map<string, string[]>,
): string | undefined {
  for (const serviceId of serviceIds) {
    // Línea cuyo servicio se borró del catálogo: el histórico se conserva, la
    // foto no.
    if (!serviceId) continue;
    for (const url of imagesByService.get(serviceId) ?? []) {
      const lista = toWhatsAppImageUrl(url);
      if (lista) return lista;
    }
  }
  return undefined;
}

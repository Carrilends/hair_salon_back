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

// La validación de la URL vive en `src/common`: la usa también el módulo de
// notificaciones para la foto de respaldo, y ninguno de los dos contextos debe
// importar del otro.
import { toWhatsAppImageUrl } from 'src/common/whatsapp-image-url';

export { toWhatsAppImageUrl };

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

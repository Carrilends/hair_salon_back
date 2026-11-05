import { toWhatsAppImageUrl } from 'src/common/whatsapp-image-url';

/**
 * Valida la foto de respaldo de `WHATSAPP_FALLBACK_IMAGE_URL` al arrancar
 * (plan 06, F1). Meta solo acepta JPEG o PNG por `https`; una URL mal puesta
 * haría fallar **cada** aviso de creación, y Meta solo lo cuenta después.
 *
 * - Vacía → `url: undefined`: aviso sin imagen (plantilla v1).
 * - Cloudinary → normalizada como las de los servicios (`f_jpg,…`).
 * - Otra `https` que ya termina en `.jpg`/`.jpeg`/`.png` → tal cual.
 * - Cualquier otra cosa → `url: undefined` y un `error` para el log. Se apaga
 *   en vez de mandarla: si la plantilla configurada es la v2 el aviso fallará
 *   igual, pero el error al arrancar dice exactamente por qué.
 */
export function imagenDeRespaldo(raw: string | undefined): {
  url: string | undefined;
  error?: string;
} {
  const valor = (raw ?? '').trim();
  if (!valor) return { url: undefined };

  const deCloudinary = toWhatsAppImageUrl(valor);
  if (deCloudinary) return { url: deCloudinary };

  try {
    const u = new URL(valor);
    if (u.protocol === 'https:' && /\.(jpe?g|png)$/i.test(u.pathname)) {
      return { url: valor };
    }
  } catch {
    // cae al error de abajo
  }
  return {
    url: undefined,
    error:
      `WHATSAPP_FALLBACK_IMAGE_URL no sirve como cabecera de WhatsApp (${valor}): ` +
      'tiene que ser https y JPEG/PNG, o una imagen de Cloudinary. ' +
      'El aviso «reserva creada» saldrá SIN imagen.',
  };
}

import { imagenDeRespaldo } from './fallback-image';

/**
 * Plan 06, F1 (revisión): la foto de respaldo se escribe a mano en el entorno,
 * así que se valida al arrancar. Un error aquí haría fallar en Meta CADA aviso
 * de creación, y Meta solo lo cuenta después, en un acuse de estado.
 */
describe('imagenDeRespaldo', () => {
  it('vacía o en blanco: aviso sin imagen, sin error', () => {
    expect(imagenDeRespaldo(undefined)).toEqual({ url: undefined });
    expect(imagenDeRespaldo('   ')).toEqual({ url: undefined });
  });

  it('una de Cloudinary se normaliza igual que las de los servicios', () => {
    expect(
      imagenDeRespaldo(
        'https://res.cloudinary.com/demo/image/upload/v1/whatsapp/r.webp',
      ),
    ).toEqual({
      url: 'https://res.cloudinary.com/demo/image/upload/f_jpg,w_800,c_limit/v1/whatsapp/r.webp',
    });
  });

  it('otra https que ya es JPEG o PNG se acepta tal cual', () => {
    expect(imagenDeRespaldo('https://ejemplo.com/salon.JPG')).toEqual({
      url: 'https://ejemplo.com/salon.JPG',
    });
  });

  it.each([
    ['http', 'http://ejemplo.com/salon.jpg'],
    ['un WebP fuera de Cloudinary', 'https://ejemplo.com/salon.webp'],
    ['algo que no es URL', 'salon.jpg'],
  ])('rechaza %s, con un error que explica qué pasa', (_caso, url) => {
    const r = imagenDeRespaldo(url);
    expect(r.url).toBeUndefined();
    expect(r.error).toMatch(/WHATSAPP_FALLBACK_IMAGE_URL/);
  });
});

import { toWhatsAppImageUrl } from './whatsapp-image-url';

const CLOUD = 'https://res.cloudinary.com/demo/image/upload';

/**
 * Casos que la revisión de F1 (plan 06) señaló: la URL se analiza y se
 * reescribe por la misma vía, anclada, sin romper lo que ya traía.
 */
describe('toWhatsAppImageUrl · bordes', () => {
  it('no amplía las fotos pequeñas (c_limit)', () => {
    expect(toWhatsAppImageUrl(`${CLOUD}/v1/a.jpg`)).toBe(
      `${CLOUD}/f_jpg,w_800,c_limit/v1/a.jpg`,
    );
  });

  it('con una transformación previa, la nuestra va detrás y manda', () => {
    expect(toWhatsAppImageUrl(`${CLOUD}/f_auto,q_auto/v1/a.webp`)).toBe(
      `${CLOUD}/f_auto,q_auto/f_jpg,w_800,c_limit/v1/a.webp`,
    );
  });

  it('sin versión, la pone justo tras upload/', () => {
    expect(toWhatsAppImageUrl(`${CLOUD}/uploads/a.jpg`)).toBe(
      `${CLOUD}/f_jpg,w_800,c_limit/uploads/a.jpg`,
    );
  });

  it('si ya lleva la nuestra, no la duplica', () => {
    const lista = `${CLOUD}/f_jpg,w_800,c_limit/v1/a.jpg`;
    expect(toWhatsAppImageUrl(lista)).toBe(lista);
  });

  it('conserva la consulta y normaliza el host en mayúsculas', () => {
    expect(
      toWhatsAppImageUrl(
        'https://RES.Cloudinary.com/demo/image/upload/v1/a.jpg?x=1',
      ),
    ).toBe(`${CLOUD}/f_jpg,w_800,c_limit/v1/a.jpg?x=1`);
  });

  it('quita los espacios sobrantes', () => {
    expect(toWhatsAppImageUrl(`  ${CLOUD}/v1/a.jpg `)).toBe(
      `${CLOUD}/f_jpg,w_800,c_limit/v1/a.jpg`,
    );
  });

  it.each([
    [
      'raw que contiene /image/upload/',
      'https://res.cloudinary.com/demo/raw/upload/image/upload/x',
    ],
    [
      'entrega privada',
      'https://res.cloudinary.com/demo/image/private/s--x--/v1/a.jpg',
    ],
    [
      'entrega autenticada',
      'https://res.cloudinary.com/demo/image/authenticated/s--x--/v1/a.jpg',
    ],
    ['upload sin nada detrás', 'https://res.cloudinary.com/demo/image/upload/'],
  ])('descarta %s', (_caso, url) => {
    expect(toWhatsAppImageUrl(url)).toBeNull();
  });
});

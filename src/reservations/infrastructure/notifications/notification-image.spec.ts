import {
  pickNotificationImage,
  toWhatsAppImageUrl,
} from './notification-image';

const CLOUD = 'https://res.cloudinary.com/demo/image/upload';

describe('toWhatsAppImageUrl', () => {
  it('fuerza JPG y un ancho de 800 en una URL de Cloudinary', () => {
    expect(toWhatsAppImageUrl(`${CLOUD}/v1/uploads/corte.webp`)).toBe(
      `${CLOUD}/f_jpg,w_800/v1/uploads/corte.webp`,
    );
  });

  it('también convierte un AVIF: Meta solo acepta JPEG o PNG en la cabecera', () => {
    expect(toWhatsAppImageUrl(`${CLOUD}/v1/uploads/tinte.avif`)).toBe(
      `${CLOUD}/f_jpg,w_800/v1/uploads/tinte.avif`,
    );
  });

  it.each([
    ['la URL por defecto de la columna', '/'],
    ['una cadena vacía', ''],
    ['un marcador de placehold.co', 'https://placehold.co/600x400?text=Corte'],
    ['otro host', 'https://ejemplo.com/image/upload/v1/corte.jpg'],
    ['http sin TLS', 'http://res.cloudinary.com/demo/image/upload/v1/c.jpg'],
    [
      'un vídeo de Cloudinary',
      'https://res.cloudinary.com/demo/video/upload/v1/c.mp4',
    ],
    ['algo que no es una URL', 'no es una url'],
  ])('descarta %s', (_motivo, url) => {
    expect(toWhatsAppImageUrl(url)).toBeNull();
  });
});

describe('pickNotificationImage', () => {
  it('elige la primera imagen válida del primer servicio que tenga una', () => {
    const imagenes = new Map([
      ['s1', ['/']],
      ['s2', [`${CLOUD}/v1/uploads/peinado.jpg`]],
    ]);

    expect(pickNotificationImage(['s1', 's2'], imagenes)).toBe(
      `${CLOUD}/f_jpg,w_800/v1/uploads/peinado.jpg`,
    );
  });

  it('respeta el orden de las líneas de la reserva, no el del mapa', () => {
    const imagenes = new Map([
      ['s2', [`${CLOUD}/v1/uploads/peinado.jpg`]],
      ['s1', [`${CLOUD}/v1/uploads/corte.jpg`]],
    ]);

    expect(pickNotificationImage(['s1', 's2'], imagenes)).toBe(
      `${CLOUD}/f_jpg,w_800/v1/uploads/corte.jpg`,
    );
  });

  it('si la principal no sirve, pasa a la siguiente del mismo servicio', () => {
    const imagenes = new Map([
      ['s1', ['https://placehold.co/600x400', `${CLOUD}/v1/uploads/corte.jpg`]],
    ]);

    expect(pickNotificationImage(['s1'], imagenes)).toBe(
      `${CLOUD}/f_jpg,w_800/v1/uploads/corte.jpg`,
    );
  });

  it('salta las líneas cuyo servicio ya no existe en el catálogo', () => {
    const imagenes = new Map([['s2', [`${CLOUD}/v1/uploads/peinado.jpg`]]]);

    expect(pickNotificationImage([null, 's2'], imagenes)).toBe(
      `${CLOUD}/f_jpg,w_800/v1/uploads/peinado.jpg`,
    );
  });

  it('devuelve undefined si ningún servicio tiene una imagen válida', () => {
    const imagenes = new Map([['s1', ['/', '']]]);

    expect(pickNotificationImage(['s1', 's2'], imagenes)).toBeUndefined();
  });
});

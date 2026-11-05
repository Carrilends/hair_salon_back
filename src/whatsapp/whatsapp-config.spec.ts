import { asistenteActivado, configDelCanal } from './whatsapp-config';

describe('configuración del canal (plan 06, F5)', () => {
  it('el asistente está apagado salvo WHATSAPP_ASSISTANT_ENABLED=true', () => {
    expect(asistenteActivado({})).toBe(false);
    expect(asistenteActivado({ WHATSAPP_ASSISTANT_ENABLED: 'false' })).toBe(
      false,
    );
    expect(asistenteActivado({ WHATSAPP_ASSISTANT_ENABLED: '1' })).toBe(false);
    expect(asistenteActivado({ WHATSAPP_ASSISTANT_ENABLED: 'true' })).toBe(
      true,
    );
  });

  it('la política sale del primer FRONT_URL, sin barra final', () => {
    expect(
      configDelCanal({
        FRONT_URL: 'https://peluqueriamarlene.com/, http://localhost:9000',
      }).politicaUrl,
    ).toBe('https://peluqueriamarlene.com/politica-tratamiento-datos');
  });

  it('sin FRONT_URL no hay enlace', () => {
    expect(configDelCanal({}).politicaUrl).toBeUndefined();
  });

  it('conserva dueña y zona horaria como antes', () => {
    expect(
      configDelCanal({ SALON_OWNER_WHATSAPP: '573208977471' }),
    ).toMatchObject({
      ownerPhone: '573208977471',
      timeZone: 'America/Bogota',
    });
  });

  it('la foto por defecto sale de WHATSAPP_FALLBACK_IMAGE_URL, validada', () => {
    expect(
      configDelCanal({
        WHATSAPP_FALLBACK_IMAGE_URL:
          'https://res.cloudinary.com/demo/image/upload/v17/respaldo.webp',
      }).imagenPorDefecto,
    ).toContain('f_jpg,w_800,c_limit');
    expect(
      configDelCanal({ WHATSAPP_FALLBACK_IMAGE_URL: 'http://x.com/a.jpg' })
        .imagenPorDefecto,
    ).toBeUndefined();
    expect(configDelCanal({}).imagenPorDefecto).toBeUndefined();
  });
});

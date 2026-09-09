import { BRAND_PINK, SALON_NAME, renderBrandedEmail } from './branded-email';

/**
 * Envoltorio HTML común a los tres correos. El correo no es la web: los clientes
 * soportan un subconjunto pobre de HTML, así que la maquetación va en tablas con
 * CSS en línea y ancho máximo de 600 px, sin hojas externas, sin fuentes
 * remotas y sin JavaScript.
 */
describe('renderBrandedEmail', () => {
  const base = {
    title: 'Restablece tu contraseña',
    paragraphs: ['Hola Ana:', 'Recibimos una solicitud.'],
    action: {
      label: 'Elegir contraseña nueva',
      url: 'https://peluqueriamarlene.com/auth/restablecer?token=abc123',
    },
    footnote: 'El enlace vence en 30 minutos.',
  };

  it('pone el nombre de la peluquería en la cabecera sobre el rosa de la marca, y también en el pie', () => {
    const html = renderBrandedEmail(base);

    const header = html.slice(0, html.indexOf(base.title));
    expect(header).toContain(SALON_NAME);
    expect(header).toContain(BRAND_PINK);

    const footer = html.slice(html.lastIndexOf(base.footnote));
    expect(footer).toContain(SALON_NAME);
  });

  it('repite el enlace como texto copiable, además del botón', () => {
    const html = renderBrandedEmail(base);

    // Una vez en el href del botón y otra como texto visible: si el cliente
    // bloquea el HTML o el botón no se pinta, el enlace sigue siendo usable.
    const veces = html.split(base.action.url).length - 1;
    expect(veces).toBeGreaterThanOrEqual(2);

    // Y el texto copiable NO puede estar solo dentro de un atributo href.
    const fueraDeHref = html.replace(/href="[^"]*"/g, '');
    expect(fueraDeHref).toContain(base.action.url);
  });

  it('escapa el HTML de los valores que vienen de fuera', () => {
    const html = renderBrandedEmail({
      ...base,
      paragraphs: ['Hola <script>alert(1)</script> & "Ana":'],
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('se maqueta con tablas y CSS en línea, sin hojas externas ni scripts', () => {
    const html = renderBrandedEmail(base);

    expect(html).toContain('<table');
    expect(html).toContain('style="');
    expect(html).toContain('max-width:600px');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('class=');
  });

  it('omite el bloque de acción cuando el mensaje no lleva enlace', () => {
    const html = renderBrandedEmail({
      title: 'Nueva reserva',
      paragraphs: ['Se registró una reserva nueva.'],
    });

    expect(html).toContain('Nueva reserva');
    expect(html).not.toContain('href=');
  });
});

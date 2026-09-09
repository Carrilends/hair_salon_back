/** Rosa de la identidad visual (`hari_salon_front/src/css/quasar.variables.scss`). */
export const BRAND_PINK = '#f8bbd0';
/** Wordmark tipográfico: no hay logotipo (decisión C4 del plan de correo). */
export const SALON_NAME = 'Peluquería Marlene';
const SALON_ADDRESS = 'Carrera 3 #1-18, Sopó, Cundinamarca';

/** Pila tipográfica del sistema: los clientes de correo no cargan fuentes remotas. */
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export interface BrandedEmailAction {
  label: string;
  url: string;
}

export interface BrandedEmailContent {
  title: string;
  paragraphs: string[];
  action?: BrandedEmailAction;
  footnote?: string;
}

/** Todo valor que venga de fuera (nombres, servicios) pasa por aquí: un nombre
 * con `<` rompería la maqueta, y peor. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Envuelve el contenido de un correo en el HTML de la peluquería.
 *
 * **Restricciones del medio, que no son opcionales.** Los clientes de correo
 * soportan un subconjunto pobre de HTML: se maqueta con **tablas** (no flexbox
 * ni grid), el CSS va **en línea**, el ancho máximo es de **600 px**, la
 * tipografía es la del sistema y no hay JavaScript ni hojas externas.
 *
 * **El enlace se repite como texto copiable.** Si el cliente bloquea el HTML o
 * no pinta el botón, el enlace de verificación o de restablecimiento debe poder
 * copiarse a mano; de lo contrario el correo llega inservible.
 *
 * **Sin logotipo (C4).** La cabecera es un wordmark tipográfico. Cuando exista
 * un logotipo real, sustituir el `<span>` de la cabecera por un `<img>` servido
 * desde una URL pública y estable (Cloudinary sirve): los clientes de correo no
 * muestran de forma fiable las imágenes incrustadas.
 */
export function renderBrandedEmail(content: BrandedEmailContent): string {
  const cuerpo = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#333333;">${escapeHtml(
          p,
        )}</p>`,
    )
    .join('');

  const accion = content.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
<tr><td style="background-color:${BRAND_PINK};border-radius:4px;">
<a href="${escapeHtml(
        content.action.url,
      )}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:16px;font-weight:bold;color:#333333;text-decoration:none;">${escapeHtml(
        content.action.label,
      )}</a>
</td></tr></table>
<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#666666;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><span style="word-break:break-all;color:#333333;">${escapeHtml(
        content.action.url,
      )}</span></p>`
    : '';

  const nota = content.footnote
    ? `<p style="margin:0;font-size:14px;line-height:1.5;color:#666666;">${escapeHtml(
        content.footnote,
      )}</p>`
    : '';

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background-color:#faf7f8;font-family:${FONT};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td align="center" style="background-color:${BRAND_PINK};padding:24px;">
<span style="font-family:${FONT};font-size:22px;font-weight:bold;letter-spacing:0.5px;color:#333333;">${SALON_NAME}</span>
</td></tr>
<tr><td style="padding:24px;font-family:${FONT};">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#333333;">${escapeHtml(
    content.title,
  )}</h1>
${cuerpo}${accion}${nota}
</td></tr>
<tr><td style="padding:16px 24px 24px;font-family:${FONT};font-size:12px;line-height:1.5;color:#999999;text-align:center;">
${SALON_NAME} · ${SALON_ADDRESS}<br>Este es un mensaje automático; no respondas a este correo.
</td></tr>
</table>
</td></tr>
</table>`;
}

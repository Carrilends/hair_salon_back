/**
 * El criterio de precio de la clienta, en un sitio que pueden leer las dos
 * capas que lo necesitan.
 *
 * Vivía dentro del adaptador del catálogo, que es quien lo usa para ordenar por
 * precio ascendente. Desde el plan 04 lo necesita también la capa de aplicación,
 * para **no reordenar por relevancia cuando la clienta ya dijo cómo quería el
 * orden**: ordenar cantidades es exactamente lo que un modelo hace mal, y si
 * ella pidió «lo más barato», eso lo ordena el código. Importar infraestructura
 * desde aplicación no vale, y tener dos listas que se desincronicen menos.
 */

/**
 * Adjetivos de precio: no son palabras del catálogo, pero tampoco son ruido.
 * Descartarlos sin más hacía que «algo barato para las uñas» encabezara con las
 * acrílicas de 78.000; fijan la ordenación por precio.
 */
export const ADJETIVOS_DE_PRECIO: ReadonlySet<string> = new Set([
  'barata',
  'baratas',
  'barato',
  'baratos',
  'economica',
  'economicas',
  'economico',
  'economicos',
]);

/** Pliega los diacríticos: quien teclea desde el móvil escribe «economico». */
const sinDiacriticos = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** ¿El texto de la clienta pide el orden por precio ascendente? */
export function pidePrecioAscendente(texto: string | undefined): boolean {
  return (texto ?? '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map(sinDiacriticos)
    .some((palabra) => ADJETIVOS_DE_PRECIO.has(palabra));
}

import { analizarBusqueda, sinDiacriticos } from './catalog-search';

/** Máximo de servicios presentados por turno de WhatsApp. */
export const MAX_SERVICIOS_WHATSAPP = 6;

/**
 * Palabras que piden «ver todo» y no nombran un servicio. Solo valen en
 * WhatsApp: en la web y en MCP «catálogo» conserva su comportamiento.
 */
const PEDIR_TODO = new Set([
  'catalogo',
  'completo',
  'carta',
  'menu',
  'lista',
  'todo',
  'todos',
  'todas',
]);

const LONGITUD_RAIZ = 4;

/** Raíz de comparación: sin tildes, en minúscula y con los 4 primeros caracteres. */
function raiz(palabra: string): string {
  return sinDiacriticos(palabra.toLowerCase()).slice(0, LONGITUD_RAIZ);
}

function raicesDe(texto: string): Set<string> {
  return new Set(
    texto
      .split(/[^\p{L}\p{N}]+/u)
      .filter((p) => p.length > 0)
      .map(raiz),
  );
}

/** Un trozo de la búsqueda sin puntuación, tildes ni mayúsculas. */
function plegarToken(token: string): string {
  return sinDiacriticos(token.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''));
}

/** Lo que la clienta busca de verdad, sin las palabras de «dame todo». */
export function conceptoDe(busqueda?: string): string[] {
  const { palabras, ambiguas } = analizarBusqueda(busqueda);
  return [...palabras, ...ambiguas].filter((p) => !PEDIR_TODO.has(p));
}

/**
 * La búsqueda sin las palabras de «dame todo» («catálogo de uñas» ⇒ «de uñas»).
 * El resto (género, precio) se conserva tal cual: solo se quitan esas palabras.
 */
export function sinPalabrasDeTodo(busqueda?: string): string | undefined {
  if (busqueda === undefined) return undefined;
  return busqueda
    .split(/\s+/)
    .filter((t) => !PEDIR_TODO.has(plegarToken(t)))
    .join(' ')
    .trim();
}

/**
 * El concepto tal como se escribió, con sus tildes y su ñ, para nombrarlo en una
 * pregunta: «uñas», no la forma plegada «unas», y sin el relleno («de», «para»).
 */
export function conceptoLegible(busqueda?: string): string {
  const concepto = conceptoDe(busqueda);
  const palabras = new Set(concepto);
  const legibles = (sinPalabrasDeTodo(busqueda) ?? '')
    .split(/\s+/)
    .filter((t) => palabras.has(plegarToken(t)));
  return (legibles.length > 0 ? legibles : concepto).join(' ');
}

/** ¿`busqueda` es exactamente este nombre? Sin tildes, mayúsculas ni espacios de más. */
export function esElNombreExacto(nombre: string, busqueda?: string): boolean {
  if (busqueda === undefined) return false;
  const plegar = (t: string) =>
    sinDiacriticos(t.toLowerCase()).trim().replace(/\s+/g, ' ');
  return plegar(nombre) === plegar(busqueda);
}

/** Alguna de las palabras fue mencionada (por raíz) en los mensajes recientes. */
export function estaAnclado(
  palabras: string[],
  recientes: { texto: string }[],
): boolean {
  if (recientes.length === 0) return false;
  const mencionadas = new Set<string>();
  for (const m of recientes) {
    for (const r of raicesDe(m.texto)) mencionadas.add(r);
  }
  return palabras.some((p) => mencionadas.has(raiz(p)));
}

/** El último mensaje del asistente es una pregunta que nombra el concepto. */
export function yaPreguntoSobre(
  palabras: string[],
  recientes: { rol: 'clienta' | 'asistente'; texto: string }[],
): boolean {
  const ultimo = [...recientes].reverse().find((m) => m.rol === 'asistente');
  if (!ultimo || !ultimo.texto.includes('?')) return false;
  const raices = raicesDe(ultimo.texto);
  return palabras.some((p) => raices.has(raiz(p)));
}

/** Servicios cuyo nombre contiene todas las palabras (por raíz). */
export function coincidenEnNombre<T extends { nombre: string }>(
  servicios: T[],
  palabras: string[],
): T[] {
  return servicios.filter((s) => {
    const raices = raicesDe(s.nombre);
    return palabras.every((p) => raices.has(raiz(p)));
  });
}

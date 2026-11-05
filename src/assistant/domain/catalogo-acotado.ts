import { analizarBusqueda, sinDiacriticos } from './catalog-search';

/** Máximo de servicios presentados por turno de WhatsApp. */
export const MAX_SERVICIOS_WHATSAPP = 6;

/**
 * Palabras que piden «ver todo» o «me da igual» y no nombran un servicio. Solo
 * valen en WhatsApp: en la web y en MCP «catálogo» conserva su comportamiento.
 * Ninguna es palabra del nombre de un servicio o etiqueta (consultado en la base
 * sembrada el 2026-11-04): si un día lo fuera, dejaría de poder buscarse.
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
  'igual',
  'cualquiera',
  'cualquier',
  'sea',
  'muestrame',
  'mandame',
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

/**
 * ¿`busqueda` es exactamente este nombre? Sin tildes, mayúsculas, espacios de más
 * ni puntuación final: «Me interesa el servicio Capas en U.» deja el punto pegado.
 */
export function esElNombreExacto(nombre: string, busqueda?: string): boolean {
  if (busqueda === undefined) return false;
  const plegar = (t: string) =>
    sinDiacriticos(t.toLowerCase())
      .replace(/[^\p{L}\p{N}]+$/u, '')
      .trim()
      .replace(/\s+/g, ' ');
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

type Reciente = { rol: 'clienta' | 'asistente'; texto: string };

/** Lo que el servidor anota en el historial al preguntar «¿qué buscas?». */
export const MARCA_PREGUNTO_QUE_BUSCA = '[Se le preguntó qué busca]';

/**
 * Lo que el servidor anota al preguntar para acotar. Solo lleva palabras de
 * `conceptoDe` y va en el mensaje guardado, nunca en el que se envía.
 */
export function marcaDeAcotar(concepto: string[]): string {
  return `[Se le preguntó para acotar: ${concepto.join(' ')}]`;
}

const MARCA_DE_ACOTAR = /\[Se le preguntó para acotar: ([^\]]*)\]/g;

function ultimoDelAsistente(recientes: Reciente[]): string | undefined {
  return [...recientes].reverse().find((m) => m.rol === 'asistente')?.texto;
}

/**
 * El ÚLTIMO mensaje del asistente lleva la marca de haber preguntado para acotar
 * este concepto (por raíz). Es un hecho que anota el servidor: no depende de cómo
 * redacte el modelo, y una cortesía con «?» no cuenta.
 */
export function yaPreguntoSobre(
  palabras: string[],
  recientes: Reciente[],
): boolean {
  const ultimo = ultimoDelAsistente(recientes);
  if (!ultimo) return false;
  const raices = new Set<string>();
  for (const [, concepto] of ultimo.matchAll(MARCA_DE_ACOTAR)) {
    for (const r of raicesDe(concepto)) raices.add(r);
  }
  return palabras.some((p) => raices.has(raiz(p)));
}

/**
 * El concepto de la última marca de acotar del ÚLTIMO mensaje del asistente, o
 * vacío si no la lleva: sobre qué se le acaba de preguntar.
 */
export function conceptoPreguntado(recientes: Reciente[]): string[] {
  const marcas = [
    ...(ultimoDelAsistente(recientes) ?? '').matchAll(MARCA_DE_ACOTAR),
  ];
  return marcas.at(-1)?.[1].split(/\s+/).filter(Boolean) ?? [];
}

/** El ÚLTIMO mensaje del asistente lleva la marca de haber preguntado qué busca. */
export function yaPreguntoQueBusca(recientes: Reciente[]): boolean {
  return (
    ultimoDelAsistente(recientes)?.includes(MARCA_PREGUNTO_QUE_BUSCA) ?? false
  );
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

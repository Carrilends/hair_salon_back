import {
  AssistantPresentation,
  PresentedService,
} from './assistant-presentation';
import {
  MARCA_PREGUNTO_QUE_BUSCA,
  MAX_SERVICIOS_WHATSAPP,
  marcaDeAcotar,
} from '../../domain/catalogo-acotado';

export const PESOS = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Los servicios presentados en el turno: sin repetidos, en orden, máximo 6. */
export function serviciosDelTurno(
  p: AssistantPresentation[],
): PresentedService[] {
  const vistos = new Set<string>();
  const salida: PresentedService[] = [];
  for (const x of p) {
    if (x.tipo !== 'servicios') continue;
    for (const sv of x.servicios) {
      if (vistos.has(sv.id)) continue;
      vistos.add(sv.id);
      salida.push(sv);
    }
  }
  return salida.slice(0, MAX_SERVICIOS_WHATSAPP);
}

/** El turno termina en un botón de confirmación. */
export function pideConfirmacion(p: AssistantPresentation[]): boolean {
  return p.some(
    (x) =>
      x.tipo === 'confirmar-reserva' ||
      x.tipo === 'confirmar-cancelacion' ||
      x.tipo === 'confirmar-cambio' ||
      x.tipo === 'confirmar-ausencia',
  );
}

/** `1. Corte: $ 35.000 (45 min)` */
export function lineaDeServicio(s: PresentedService, i: number): string {
  return `${i + 1}. ${s.nombre}: ${PESOS.format(s.precio)} (${s.minutos} min)`;
}

/**
 * Lo que se guarda en el historial en lugar de la lista enviada: sin ids ni
 * URL. Vacía si el turno pide confirmación o no hubo servicios.
 */
export function marcaDeServicios(p: AssistantPresentation[]): string {
  if (pideConfirmacion(p)) return '';
  const ss = serviciosDelTurno(p);
  if (ss.length === 0) return '';
  const lineas = ss.map(lineaDeServicio).join(' ; ');
  return `[Se le enviaron aparte, con foto si la hay: ${lineas}]`;
}

/**
 * Qué se anota en el historial por lo que el servidor le hizo preguntar: el hecho
 * del que dependen R1 y R6, sin depender de cómo redacte el modelo. Sin ids, sin
 * URL y sin más texto que las palabras de `conceptoDe`.
 *
 * El listado por categoría también cuenta como «qué busca», porque acaba en
 * «si buscas otro, dime cuál»: quien responde «todo» otra vez lo vuelve a recibir
 * en lugar de caer de nuevo en la pregunta.
 */
export function marcasDeAcotado(
  resultados: unknown[],
  presentaciones: AssistantPresentation[],
): string[] {
  const marcas = new Set<string>();
  for (const resultado of resultados) {
    const r = resultado as {
      ok?: unknown;
      motivo?: unknown;
      concepto?: unknown;
    };
    if (r?.ok !== false) continue;
    if (r.motivo === 'falta_concepto') marcas.add(MARCA_PREGUNTO_QUE_BUSCA);
    if (
      r.motivo === 'demasiados' &&
      Array.isArray(r.concepto) &&
      r.concepto.length > 0
    ) {
      marcas.add(marcaDeAcotar(r.concepto as string[]));
    }
  }
  const listoPorCategoria = presentaciones.some(
    (p) =>
      p.tipo === 'servicios' && p.criterio === 'menor_precio_por_categoria',
  );
  if (listoPorCategoria && !pideConfirmacion(presentaciones)) {
    marcas.add(MARCA_PREGUNTO_QUE_BUSCA);
  }
  return [...marcas];
}

/**
 * Cualquier nota del historial que empiece por «[Se le »: el modelo no las copia
 * siempre igual («envió» por «enviaron») y cada variante llegaría a la clienta.
 */
const MARCA_COPIADA = /\[s[eé] l[eé] [^\]]*\]/giu;

/**
 * Quita de la respuesta del modelo las notas del historial: si las copia, la
 * clienta las leería y contarían como un hecho que el servidor no anotó. Solo
 * esas, y un texto sin ellas queda intacto.
 */
export function sinMarcasCopiadas(texto: string): string {
  const limpio = texto.replace(MARCA_COPIADA, '');
  if (limpio === texto) return texto;
  return limpio
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

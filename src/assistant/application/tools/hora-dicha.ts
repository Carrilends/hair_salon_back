import { AssistantContext } from './assistant-tool';
import { horaDelSalon } from '../salon-day';

/**
 * La hora que la clienta escribió (prueba con móvil del 2026-11-10).
 *
 * «Quiero reservar el Taper Fade el viernes 10 a nombre de Luisa» terminó en
 * una propuesta a las 8:00: el modelo leyó «10» como el día y se inventó la
 * hora. El resumen y el botón «Confirmar» lo dejaban ver, pero una propuesta
 * no debe nacer a una hora que nadie dijo. La regla es del servidor y solo de
 * WhatsApp: la web y MCP no la tienen.
 */

/** Lo que la herramienta responde en lugar de proponer. */
export const PREGUNTA_HORA =
  '¿A qué hora la quieres? Escríbela así: 10:00 a. m.';

/** Una hora escrita por la clienta, tal como se pudo leer. */
export interface HoraEscrita {
  /** 0–23. De 1 a 12 sin franja es ambigua: vale por la mañana y por la tarde. */
  hora: number;
  /** `null` si no dijo minutos («a las 10»): se entiende en punto. */
  minuto: number | null;
  /** `am` / `pm` si lo dijo («a. m.», «de la tarde»). */
  franja: 'am' | 'pm' | null;
}

const MESES =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|set|oct|nov|dic';

/**
 * Lo que tiene números pero no es una hora, y se borra antes de buscar:
 * el día del mes («13 de noviembre», «13/11»), los precios («$25.000»,
 * «25 mil») y, por la forma de buscar (uno o dos dígitos sueltos), los
 * teléfonos tampoco cuentan.
 */
const NO_SON_HORAS: RegExp[] = [
  new RegExp(`\\b\\d{1,2}\\s*(?:de\\s+)?(?:${MESES})\\b`, 'g'),
  /\b\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?\b/g,
  /\$\s*\d[\d.,]*/g,
  /\b\d{1,3}(?:[.,]\d{3})+\b/g,
  /\b\d+\s*(?:mil|k|pesos|cop|lucas)\b/g,
];

const EN_LETRAS: Record<string, number> = {
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
};

/**
 * Un número de una o dos cifras, con lo que puede acompañarlo: minutos
 * («10:30»), «y media» / «y cuarto» y la franja («a. m.», «pm», «de la tarde»).
 */
const NUMERO =
  /(?<![\d/.,$:])\b(\d{1,2})(?::(\d{2}))?(?:\s+y\s+(media|cuarto))?(?:\s*(a\.?\s*m\.?(?![a-z])|p\.?\s*m\.?(?![a-z])|de\s+la\s+(?:manana|tarde|noche)))?(?![\d/:])/g;

/**
 * Un número sin minutos ni franja solo cuenta como hora detrás de «a las», «la»
 * o un día («viernes 10», «mañana 9»). Es ambiguo a propósito: «viernes 10»
 * puede ser el día 10, pero el objetivo es no proponer otra hora distinta, así
 * que se toma como hora posible.
 */
const DETRAS_DE =
  /(?:\b(?:a\s+)?las?|\b(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo|hoy|manana))\s+$/;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ /g, ' ');
}

/** Las horas que se pueden leer en un mensaje. Conservadora con lo dudoso. */
export function horasEscritas(texto: string): HoraEscrita[] {
  let t = normalizar(texto);
  for (const re of NO_SON_HORAS) t = t.replace(re, ' ');
  t = t.replace(
    /\b(a\s+las?\s+)(una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g,
    (_m, antes: string, palabra: string) => `${antes}${EN_LETRAS[palabra]}`,
  );

  const horas: HoraEscrita[] = [];
  if (/\bmedio\s*dia\b/.test(t)) {
    horas.push({ hora: 12, minuto: 0, franja: 'pm' });
  }
  for (const m of t.matchAll(NUMERO)) {
    const [, h, mm, fraccion, sufijo] = m;
    const conDetalle =
      mm !== undefined || fraccion !== undefined || sufijo !== undefined;
    if (!conDetalle && !DETRAS_DE.test(t.slice(0, m.index))) continue;
    const hora = Number(h);
    const minuto =
      mm !== undefined
        ? Number(mm)
        : fraccion === 'media'
          ? 30
          : fraccion === 'cuarto'
            ? 15
            : null;
    if (hora > 23 || (minuto !== null && minuto > 59)) continue;
    horas.push({ hora, minuto, franja: franjaDe(sufijo) });
  }
  return horas;
}

function franjaDe(sufijo: string | undefined): HoraEscrita['franja'] {
  if (!sufijo) return null;
  if (sufijo.startsWith('a') || sufijo.endsWith('manana')) return 'am';
  return 'pm';
}

/** ¿Es `hh:mm` (24 h) una lectura posible de lo que escribió? */
function coincide(hh: number, mm: number, e: HoraEscrita): boolean {
  if ((e.minuto ?? 0) !== mm) return false;
  if (e.hora === 0 || e.hora > 12) return e.hora === hh;
  const base = e.hora % 12;
  if (e.franja === 'am') return hh === base;
  if (e.franja === 'pm') return hh === base + 12;
  return hh === base || hh === base + 12;
}

/**
 * `true` si la clienta escribió alguna hora en sus mensajes recientes y la que
 * se va a proponer (`instante`) no coincide con ninguna. Sin horas escritas no
 * se bloquea: puede estar aceptando una que le ofreció el asistente, y el
 * resumen con el botón siguen siendo la salvaguarda. Solo cuentan sus
 * mensajes, nunca las horas que ofreció el asistente.
 *
 * La usa `ProposeBookingTool` (`crearReserva` y `reservarPaquete` en WhatsApp)
 * antes de guardar nada; la web y MCP no la tienen.
 */
export function esUnaHoraNoDicha(
  instante: Date,
  recientes: AssistantContext['recientes'],
): boolean {
  const escritas = (recientes ?? [])
    .filter((m) => m.rol === 'clienta')
    .flatMap((m) => horasEscritas(m.texto));
  if (escritas.length === 0) return false;
  const [hh, mm] = horaDelSalon(instante).split(':').map(Number);
  return !escritas.some((e) => coincide(hh, mm, e));
}

/** Lo que responde la herramienta en lugar de proponer. */
export const HORA_NO_DICHA = {
  ok: false,
  motivo: 'hora_no_dicha',
  pregunta: PREGUNTA_HORA,
} as const;

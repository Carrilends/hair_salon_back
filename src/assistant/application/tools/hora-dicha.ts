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
const EJEMPLO_DE_LA_PREGUNTA = 'Escríbela así: 10:00 a. m.';

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
 * Cantidades, no horas: «el viernes 2 servicios», «para mañana 2 cortes»,
 * «para 2 personas», «las dos cosas». Se borran después de pasar los números
 * en letra a cifras.
 */
const CANTIDADES =
  /\b\d{1,2}\s+(?:de\s+)?(?:servicios?|cortes?|personas?|cosas?|citas?|clientas?|ninas?|ninos?|hijas?|hijos?|amigas?|mujeres|hombres|tintes?|unas|minutos?|mins?|horas?|hrs?|dias?|semanas?|meses|anos?|veces|opciones?|paquetes?)\b/g;

/**
 * Un número de una o dos cifras, con lo que puede acompañarlo: minutos
 * («10:30», «3 y 30», «2 y 15»), «y media» / «y cuarto» y la franja («a. m.»,
 * «pm», «de la tarde»).
 */
const NUMERO =
  /(?<![\d/.,$:])\b(\d{1,2})(?::(\d{2}))?(?:\s+y\s+(media|cuarto|\d{2}))?(?:\s*(a\.?\s*m\.?(?![a-z])|p\.?\s*m\.?(?![a-z])|de\s+la\s+(?:manana|tarde|noche)))?(?![\d/:])/g;

/**
 * Un número sin minutos ni franja solo cuenta como hora detrás de «a las»,
 * «a la» o «las» («la de las 3»), pero no detrás de «la» sola: «la 2» es la
 * segunda de una lista (revisión del 2026-11-10).
 */
const TRAS_LAS = /\b(?:a\s+las?|las)\s+$/;

/**
 * …o detrás de un día («viernes 10», «mañana 9»), y entonces solo de 1 a 12:
 * «viernes 10» es ambiguo y se toma como hora posible, porque el objetivo es
 * no proponer otra distinta; «sábado 14» es el día 14.
 */
const TRAS_UN_DIA =
  /\b(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo|hoy|manana)\s+$/;

/** Un mensaje que es solo un número («11», «3.»): la respuesta a «¿a qué hora?». */
const SOLO_UN_NUMERO = /^\s*(\d{1,2})\s*[.!]?\s*$/;

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00a0\u202f]/g, ' ');
}

/** Las horas que se pueden leer en un mensaje. Conservadora con lo dudoso. */
export function horasEscritas(texto: string): HoraEscrita[] {
  let t = normalizar(texto);
  const solo = SOLO_UN_NUMERO.exec(t);
  if (solo) {
    const hora = Number(solo[1]);
    return hora <= 23 ? [{ hora, minuto: null, franja: null }] : [];
  }
  for (const re of NO_SON_HORAS) t = t.replace(re, ' ');
  t = t.replace(
    /\b(a\s+las?\s+|las\s+)(una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/g,
    (_m, antes: string, palabra: string) => `${antes}${EN_LETRAS[palabra]}`,
  );
  t = t.replace(CANTIDADES, ' ');

  const horas: HoraEscrita[] = [];
  if (/\bmedio\s*dia\b/.test(t)) {
    horas.push({ hora: 12, minuto: 0, franja: 'pm' });
  }
  for (const m of t.matchAll(NUMERO)) {
    const [, h, mm, fraccion, sufijo] = m;
    const hora = Number(h);
    const conDetalle =
      mm !== undefined || fraccion !== undefined || sufijo !== undefined;
    if (!conDetalle) {
      const antes = t.slice(0, m.index);
      const trasUnDia = TRAS_UN_DIA.test(antes);
      if (!TRAS_LAS.test(antes) && !trasUnDia) continue;
      if (trasUnDia && (hora < 1 || hora > 12)) continue;
    }
    const minuto =
      mm !== undefined
        ? Number(mm)
        : fraccion === 'media'
          ? 30
          : fraccion === 'cuarto'
            ? 15
            : fraccion !== undefined
              ? Number(fraccion)
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

/** El ejemplo de la pregunta fija («10:00 a. m.») no es una hora ofrecida. */
function sinLaPreguntaFija(texto: string): string {
  return texto
    .split(PREGUNTA_HORA)
    .join(' ')
    .split(EJEMPLO_DE_LA_PREGUNTA)
    .join(' ');
}

/**
 * `true` si la clienta escribió alguna hora en sus mensajes recientes y la que
 * se va a proponer (`instante`) no coincide con ninguna. Sin horas escritas no
 * se bloquea: el resumen con el botón siguen siendo la salvaguarda.
 *
 * Si su último mensaje no trae hora («sí», «la primera», «listo»), está
 * contestando al asistente: valen también las horas del mensaje del asistente
 * justo antes, sin el ejemplo de la pregunta fija (revisión del 2026-11-10).
 * Si su último mensaje trae hora, solo cuentan las suyas: el caso de Luis
 * («el viernes 10») sigue sin aceptar las 8:00 aunque el asistente las hubiera
 * nombrado antes.
 *
 * La usa `ProposeBookingTool` (`crearReserva` y `reservarPaquete` en WhatsApp)
 * antes de guardar nada; la web y MCP no la tienen.
 */
export function esUnaHoraNoDicha(
  instante: Date,
  recientes: AssistantContext['recientes'],
): boolean {
  const mensajes = recientes ?? [];
  const escritas = mensajes
    .filter((m) => m.rol === 'clienta')
    .flatMap((m) => horasEscritas(m.texto));
  if (escritas.length === 0) return false;

  const validas = [...escritas];
  const ultimo = mensajes.map((m) => m.rol).lastIndexOf('clienta');
  const anterior = mensajes[ultimo - 1];
  if (
    horasEscritas(mensajes[ultimo].texto).length === 0 &&
    anterior?.rol === 'asistente'
  ) {
    validas.push(...horasEscritas(sinLaPreguntaFija(anterior.texto)));
  }

  const [hh, mm] = horaDelSalon(instante).split(':').map(Number);
  return !validas.some((e) => coincide(hh, mm, e));
}

/** Lo que responde la herramienta en lugar de proponer. */
export const HORA_NO_DICHA = {
  ok: false,
  motivo: 'hora_no_dicha',
  pregunta: PREGUNTA_HORA,
  instruccion:
    'No vuelvas a llamar a esta herramienta en este turno: pregúntale a qué hora la quiere y espera su respuesta.',
} as const;

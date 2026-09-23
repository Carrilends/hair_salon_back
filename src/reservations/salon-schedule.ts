/**
 * Debe mantenerse alineado con `hari_salon_front/src/helpers/businessHours.ts`
 * (getBusinessDayBounds / rangos LV vs fin de semana).
 */
// `*_CLOSE_MIN` es la hora de cierre (minutos desde medianoche): el último
// instante en que una reserva puede TERMINAR. L–V 08:00–20:00; S/D/festivos
// 09:00–19:00. Debe coincidir con `hari_salon_front/src/helpers/businessHours.ts`.
export const WEEKDAY_OPEN_MIN = 8 * 60;
export const WEEKDAY_CLOSE_MIN = 20 * 60;
export const WEEKEND_OPEN_MIN = 9 * 60;
export const WEEKEND_CLOSE_MIN = 19 * 60;

/** Día de la semana (0=domingo … 6=sábado) para una fecha civil gregoriana. */
export function weekdayUtcSun0(y: number, month: number, day: number): number {
  return new Date(Date.UTC(y, month - 1, day)).getUTCDay();
}

export function isWeekendYmd(y: number, month: number, day: number): boolean {
  const dow = weekdayUtcSun0(y, month, day);
  return dow === 0 || dow === 6;
}

/**
 * Festivos colombianos CALCULADOS, no una lista fija.
 *
 * Por qué calculados: una lista por año caduca en silencio. El día que se
 * acabara, el salón anunciaría horario de entre semana en un festivo y nadie se
 * enteraría hasta que una clienta llegara a las 08:00 y encontrara cerrado. El
 * cálculo no caduca; las pruebas (`salon-schedule.spec.ts`) fijan tres años
 * contra una lista de referencia escrita a mano, así que es igual de auditable.
 *
 * Sin dependencias nuevas: el alcance tecnológico de la tesis es estricto.
 *
 * Régimen legal: Ley 51 de 1983 («Ley Emiliani»). Hay tres familias de festivo:
 *  1. Fecha fija, nunca se traslada.
 *  2. Fecha fija trasladable: si no cae lunes, se corre al lunes siguiente.
 *  3. Móviles, derivados del Domingo de Pascua; Jueves y Viernes Santo caen
 *     donde caen y los otros tres se trasladan al lunes.
 */

/** Festivos de fecha fija que NUNCA se trasladan: [mes, día]. */
const FIJOS: [number, number][] = [
  [1, 1], // Año Nuevo
  [5, 1], // Día del Trabajo
  [7, 20], // Grito de Independencia
  [8, 7], // Batalla de Boyacá
  [12, 8], // Inmaculada Concepción
  [12, 25], // Navidad
];

/** Festivos de fecha fija que se trasladan al lunes siguiente: [mes, día]. */
const TRASLADABLES: [number, number][] = [
  [1, 6], // Reyes Magos
  [3, 19], // San José
  [6, 29], // San Pedro y San Pablo
  [8, 15], // Asunción de la Virgen
  [10, 12], // Día de la Raza
  [11, 1], // Todos los Santos
  [11, 11], // Independencia de Cartagena
];

/**
 * Desplazamientos en días desde el Domingo de Pascua.
 *
 * Ascensión (+40), Corpus Christi (+61) y Sagrado Corazón (+68) caen en jueves
 * y viernes y se trasladan al lunes siguiente; los desplazamientos de abajo ya
 * incorporan ese traslado (+43, +64, +71), por eso no vuelven a pasar por
 * `siguienteLunes`. Jueves y Viernes Santo no se trasladan nunca.
 */
const PASCUA_SIN_TRASLADO = [-3, -2]; // Jueves Santo, Viernes Santo
const PASCUA_CON_TRASLADO = [43, 64, 71]; // Ascensión, Corpus, Sagrado Corazón

/**
 * Domingo de Pascua (algoritmo anónimo gregoriano de Meeus/Jones/Butcher).
 * Determinista y válido para cualquier año del calendario gregoriano.
 */
function domingoDePascua(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, mes - 1, dia));
}

/** Lunes siguiente, o el mismo día si YA es lunes (traslado Emiliani). */
function siguienteLunes(fecha: Date): Date {
  const dow = fecha.getUTCDay(); // 0 = domingo, 1 = lunes
  const faltan = (8 - dow) % 7; // lunes → 0; martes → 6; domingo → 1
  return new Date(fecha.getTime() + faltan * 24 * 60 * 60 * 1000);
}

function claveYmd(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

// Memoria por año: el cálculo es puro y se consulta una vez por día mostrado en
// el calendario, así que repetirlo sería gratuito pero inútil.
const cacheFestivos = new Map<number, Set<string>>();

/** Festivos colombianos de un año, como claves `YYYY-MM-DD`. */
export function colombianHolidaysOfYear(year: number): Set<string> {
  const enCache = cacheFestivos.get(year);
  if (enCache) return enCache;

  const festivos = new Set<string>();

  for (const [mes, dia] of FIJOS) {
    festivos.add(claveYmd(new Date(Date.UTC(year, mes - 1, dia))));
  }
  for (const [mes, dia] of TRASLADABLES) {
    festivos.add(
      claveYmd(siguienteLunes(new Date(Date.UTC(year, mes - 1, dia)))),
    );
  }

  const pascua = domingoDePascua(year);
  const dia = 24 * 60 * 60 * 1000;
  for (const off of [...PASCUA_SIN_TRASLADO, ...PASCUA_CON_TRASLADO]) {
    festivos.add(claveYmd(new Date(pascua.getTime() + off * dia)));
  }

  cacheFestivos.set(year, festivos);
  return festivos;
}

/** ¿Es `y-month-day` festivo en Colombia? */
export function isColombianHolidayYmd(
  y: number,
  month: number,
  day: number,
): boolean {
  const clave = claveYmd(new Date(Date.UTC(y, month - 1, day)));
  return colombianHolidaysOfYear(y).has(clave);
}

/**
 * ¿El día usa el horario reducido 09:00–19:00? Sábados, domingos **y festivos**,
 * tal como lo promete el cartel del salón y lo afirmaba el comentario de arriba
 * desde antes de que existiera el calendario de festivos.
 */
export function usesWeekendHoursYmd(
  y: number,
  month: number,
  day: number,
): boolean {
  return isWeekendYmd(y, month, day) || isColombianHolidayYmd(y, month, day);
}

/** Minutos laborables del día (apertura→cierre), mismo criterio que el front. */
export function laborMinutesForCalendarDay(
  y: number,
  month: number,
  day: number,
): number {
  const reducido = usesWeekendHoursYmd(y, month, day);
  const openMin = reducido ? WEEKEND_OPEN_MIN : WEEKDAY_OPEN_MIN;
  const closeMin = reducido ? WEEKEND_CLOSE_MIN : WEEKDAY_CLOSE_MIN;
  return closeMin - openMin;
}

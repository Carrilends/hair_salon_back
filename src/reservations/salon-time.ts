import {
  usesWeekendHoursYmd,
  WEEKDAY_CLOSE_MIN,
  WEEKDAY_OPEN_MIN,
  WEEKEND_CLOSE_MIN,
  WEEKEND_OPEN_MIN,
} from './salon-schedule';

type SalonNow = {
  ymd: string;
  qdateKey: string;
  minOfDay: number;
  weekday: number;
};

type DayBounds = {
  openMin: number;
  closeMin: number;
  isToday: boolean;
  effectiveStartMin: number;
  effectiveCapacityMin: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseIntPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const raw = parts.find((part) => part.type === type)?.value;
  return Number(raw);
}

function parseYmd(dateYmd: string): { y: number; m: number; d: number } {
  const [yStr, mStr, dStr] = dateYmd.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  return { y, m, d };
}

/** Igual que `parseYmd` pero rechaza lo que no sea `YYYY-MM-DD` real. */
function parseYmdEstricto(
  dateYmd: string,
): { y: number; m: number; d: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  const { y, m, d } = parseYmd(dateYmd);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Rechaza un 31 de febrero: `Date.UTC` lo desbordaría al mes siguiente.
  const prueba = new Date(Date.UTC(y, m - 1, d));
  if (prueba.getUTCMonth() !== m - 1 || prueba.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function getSalonNow(tz: string): SalonNow {
  const now = getDatePartsInTz(new Date(), tz);
  const weekday = new Date(
    Date.UTC(now.year, now.month - 1, now.day),
  ).getUTCDay();

  return {
    ymd: `${now.year}-${pad2(now.month)}-${pad2(now.day)}`,
    qdateKey: `${now.year}/${pad2(now.month)}/${pad2(now.day)}`,
    minOfDay: now.hour * 60 + now.minute,
    weekday,
  };
}

export function getDatePartsInTz(
  date: Date,
  tz: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const y = parseIntPart(parts, 'year');
  const m = parseIntPart(parts, 'month');
  const d = parseIntPart(parts, 'day');
  const hour = parseIntPart(parts, 'hour');
  const minute = parseIntPart(parts, 'minute');

  return {
    year: y,
    month: m,
    day: d,
    hour,
    minute,
  };
}

export function getDayBounds(
  dateYmd: string,
  tz: string,
  salonNow = getSalonNow(tz),
): DayBounds {
  const { y, m, d } = parseYmd(dateYmd);
  // Festivo = mismo horario reducido que sábado y domingo. Es la única puerta
  // por la que pasan la validación de reserva, la agenda del portal y las
  // franjas del asistente, así que basta cambiarla aquí.
  const reducido = usesWeekendHoursYmd(y, m, d);
  const openMin = reducido ? WEEKEND_OPEN_MIN : WEEKDAY_OPEN_MIN;
  const closeMin = reducido ? WEEKEND_CLOSE_MIN : WEEKDAY_CLOSE_MIN;
  const isToday = dateYmd === salonNow.ymd;
  const effectiveStartMin = isToday
    ? Math.max(openMin, salonNow.minOfDay)
    : openMin;

  return {
    openMin,
    closeMin,
    isToday,
    effectiveStartMin,
    effectiveCapacityMin: Math.max(0, closeMin - effectiveStartMin),
  };
}

/**
 * Hora local del salón → instante ISO en UTC.
 *
 * Es la inversa de `getDatePartsInTz` y hace falta desde que una hora entra al
 * sistema ya expresada en el reloj de Bogotá (la que la clienta pulsa en una
 * lista de WhatsApp) en vez de en UTC.
 *
 * No se puede hacer con `new Date('2026-09-12T15:30')`: eso interpreta la hora
 * en la zona del **servidor**, que en Railway es UTC, y la cita saldría cinco
 * horas corrida. El rodeo es: tratar los componentes como si fueran UTC, mirar
 * qué hora local da ese instante en la zona del salón, y corregir por la
 * diferencia. Un solo paso basta salvo en el salto de horario de verano;
 * Colombia no lo tiene, y aun así se repite el ajuste por si la zona cambiara.
 */
export function salonLocalToUtcIso(
  dateYmd: string,
  hhmm: string,
  tz: string,
): string | null {
  const fecha = parseYmdEstricto(dateYmd);
  const hora = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!fecha || !hora) return null;

  const h = Number(hora[1]);
  const min = Number(hora[2]);
  if (h > 23 || min > 59) return null;

  const comoSiFueraUtc = Date.UTC(fecha.y, fecha.m - 1, fecha.d, h, min);
  let instante = comoSiFueraUtc;

  for (let i = 0; i < 2; i++) {
    const partes = getDatePartsInTz(new Date(instante), tz);
    const localComoUtc = Date.UTC(
      partes.year,
      partes.month - 1,
      partes.day,
      partes.hour,
      partes.minute,
    );
    const desfase = comoSiFueraUtc - localComoUtc;
    if (desfase === 0) break;
    instante += desfase;
  }

  return new Date(instante).toISOString();
}

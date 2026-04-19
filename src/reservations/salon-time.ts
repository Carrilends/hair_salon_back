import {
  isWeekendYmd,
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

export function getSalonNow(tz: string): SalonNow {
  const now = getDatePartsInTz(new Date(), tz);
  const weekday = new Date(Date.UTC(now.year, now.month - 1, now.day)).getUTCDay();

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
  const weekend = isWeekendYmd(y, m, d);
  const openMin = weekend ? WEEKEND_OPEN_MIN : WEEKDAY_OPEN_MIN;
  const closeMin = weekend ? WEEKEND_CLOSE_MIN : WEEKDAY_CLOSE_MIN;
  const isToday = dateYmd === salonNow.ymd;
  const effectiveStartMin = isToday
    ? Math.max(openMin, salonNow.minOfDay)
    : openMin;

  return {
    openMin,
    closeMin,
    isToday,
    effectiveStartMin,
    effectiveCapacityMin: Math.max(0, closeMin - effectiveStartMin + 1),
  };
}

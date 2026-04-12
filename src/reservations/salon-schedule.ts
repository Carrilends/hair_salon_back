/**
 * Debe mantenerse alineado con `hari_salon_front/src/helpers/businessHours.ts`
 * (getBusinessDayBounds / rangos LV vs fin de semana).
 */
export const WEEKDAY_OPEN_MIN = 8 * 60;
export const WEEKDAY_CLOSE_MIN = 21 * 60 + 59;
export const WEEKEND_OPEN_MIN = 9 * 60;
export const WEEKEND_CLOSE_MIN = 19 * 60 + 59;

/** Día de la semana (0=domingo … 6=sábado) para una fecha civil gregoriana. */
export function weekdayUtcSun0(y: number, month: number, day: number): number {
  return new Date(Date.UTC(y, month - 1, day)).getUTCDay();
}

export function isWeekendYmd(y: number, month: number, day: number): boolean {
  const dow = weekdayUtcSun0(y, month, day);
  return dow === 0 || dow === 6;
}

/** Minutos laborables del día (inclusive open–close), mismo criterio que el front. */
export function laborMinutesForCalendarDay(
  y: number,
  month: number,
  day: number,
): number {
  const weekend = isWeekendYmd(y, month, day);
  const openMin = weekend ? WEEKEND_OPEN_MIN : WEEKDAY_OPEN_MIN;
  const closeMin = weekend ? WEEKEND_CLOSE_MIN : WEEKDAY_CLOSE_MIN;
  return closeMin - openMin + 1;
}

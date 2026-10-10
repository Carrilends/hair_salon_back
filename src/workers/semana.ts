import { laborMinutesForCalendarDay } from '../reservations/salon-schedule';

/**
 * La semana del panel «Mis estilistas» (`GET /workers/availability/week`):
 * de lunes a domingo, en fechas civiles del salón (`YYYY-MM-DD`).
 *
 * Todo se calcula en UTC sobre la fecha civil: así ni la zona del servidor
 * (Railway corre en UTC) ni el salto de mes mueven un día. La única zona que
 * importa, la del salón, la aplica la consulta SQL al agrupar las reservas.
 */
const DIA_MS = 24 * 60 * 60 * 1000;

function aMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function aYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * El lunes de la semana de `ymd`. El domingo pertenece a la semana que empezó
 * el lunes anterior: `(dow + 6) % 7` cuenta los días desde el lunes (lunes 0,
 * domingo 6).
 */
export function lunesDeLaSemana(ymd: string): string {
  const ms = aMs(ymd);
  const dow = new Date(ms).getUTCDay(); // 0 domingo … 6 sábado
  return aYmd(ms - ((dow + 6) % 7) * DIA_MS);
}

/** Las siete fechas de la semana que empieza en `lunes`. */
export function diasDeLaSemana(lunes: string): string[] {
  const base = aMs(lunes);
  return Array.from({ length: 7 }, (_, i) => aYmd(base + i * DIA_MS));
}

/**
 * Minutos de horario del día: la misma regla que `getDayBounds` y que el
 * cartel (12 h entre semana; 10 h sábado, domingo y festivo). Es el día
 * ENTERO, también para hoy: la barra de la semana compara días entre sí.
 */
export function capacidadDelDia(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return laborMinutesForCalendarDay(y, m, d);
}

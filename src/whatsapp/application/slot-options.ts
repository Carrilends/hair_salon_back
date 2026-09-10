/** Rejilla de propuesta: se ofrecen horas en punto y medias. */
export const SLOT_GRID_MINUTES = 30;

export interface DayWindow {
  /** Primer minuto ofrecible del día (ya recortado contra «ahora» si es hoy). */
  effectiveStartMin: number;
  /** Minuto de cierre. Una cita puede terminar justo en él. */
  closeMin: number;
  /** Bloques ya ocupados del estilista, en minutos desde medianoche. */
  busyBlocks: { startMin: number; endMin: number }[];
}

/**
 * Horas a las que **cabe entera** una cita de `durationMinutes` ese día.
 *
 * La diferencia con la disponibilidad que consulta el asistente es justo esa:
 * aquélla ofrece franjas de 30 minutos sueltas, que sirven para orientar a un
 * modelo, pero aquí la clienta va a pulsar la hora y esperar que funcione. Una
 * cita de 90 minutos no cabe en el mismo hueco que una de 30, y ofrecerle una
 * hora que el backend va a rechazar es peor que no ofrecerle ninguna.
 *
 * Sigue siendo **orientativo**: la autoridad es el caso de uso, que revalida
 * horario, pasado y solapes al ejecutar. Entre que se envía la lista y se pulsa
 * una fila, la franja puede haberse ocupado.
 */
export function freeStartTimes(
  day: DayWindow,
  durationMinutes: number,
): string[] {
  if (durationMinutes <= 0) return [];

  const inicio = ceilToGrid(day.effectiveStartMin);
  const horas: string[] = [];

  for (
    let t = inicio;
    t + durationMinutes <= day.closeMin;
    t += SLOT_GRID_MINUTES
  ) {
    const chocaConAlgo = day.busyBlocks.some(
      (b) => t < b.endMin && t + durationMinutes > b.startMin,
    );
    if (!chocaConAlgo) horas.push(formatHHmm(t));
  }

  return horas;
}

function ceilToGrid(min: number): number {
  return Math.ceil(min / SLOT_GRID_MINUTES) * SLOT_GRID_MINUTES;
}

function formatHHmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Cómo se lee una hora de 24 h en el mensaje. Se escribe a mano y no con
 * `Intl` porque aquí solo hay minutos desde medianoche, sin fecha ni zona: la
 * conversión a instante real la hace quien construye el ISO.
 */
export function formatHumanTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const hora12 = h % 12 === 0 ? 12 : h % 12;
  return `${hora12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

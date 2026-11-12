import {
  getDatePartsInTz,
  getDayBounds,
  horaEnDoceHoras,
} from 'src/reservations/salon-time';
import { AbsenceImpact } from 'src/reservations/application/absences/absence-planner';
import { fechaYHoraEnPalabras } from '../salon-day';

/**
 * Cómo se le dice a la dueña una ausencia por WhatsApp (2026-11-11): el día,
 * la franja, el resumen y una línea por cita. Lo comparten la vista previa
 * (`marcarAusencia`), la lista (`verAusencias`) y la respuesta del botón
 * «Confirmar», para que las tres hablen igual. Horas en 12 h, como el resto
 * del canal (`horaEnDoceHoras`).
 */

const zona = () => process.env.SALON_TZ ?? 'America/Bogota';
const dos = (n: number) => String(n).padStart(2, '0');

/**
 * «jueves, 12 de noviembre de 2026» y «todo el día» o «de 8:00 a. m. a
 * 12:00 p. m.». Es «todo el día» cuando la franja coincide con el horario de
 * ese día (`getDayBounds`, festivos incluidos), que es como la guarda el
 * dominio cuando no se dan horas.
 */
export function fechaYFranja(
  startsAt: Date,
  endsAt: Date,
): { fecha: string; franja: string } {
  const tz = zona();
  const inicio = getDatePartsInTz(startsAt, tz);
  const fin = getDatePartsInTz(endsAt, tz);
  const ymd = `${inicio.year}-${dos(inicio.month)}-${dos(inicio.day)}`;
  const { openMin, closeMin } = getDayBounds(ymd, tz);
  const desde = inicio.hour * 60 + inicio.minute;
  const hasta = fin.hour * 60 + fin.minute;
  const franja =
    desde === openMin && hasta === closeMin
      ? 'todo el día'
      : `de ${horaEnDoceHoras(inicio.hour, inicio.minute)} a ${horaEnDoceHoras(fin.hour, fin.minute)}`;
  return { fecha: fechaYHoraEnPalabras(startsAt.toISOString()).fecha, franja };
}

/** «1 cita pasa a otra estilista y 2 se cancelan», o que no hay citas. */
export function resumenDeImpactos(impacts: AbsenceImpact[]): string {
  const movidas = impacts.filter((i) => i.outcome === 'reasignada').length;
  const canceladas = impacts.length - movidas;
  if (movidas === 0 && canceladas === 0) return 'No tiene citas en esas horas';
  const partes: string[] = [];
  if (movidas > 0) {
    partes.push(
      movidas === 1
        ? '1 cita pasa a otra estilista'
        : `${movidas} citas pasan a otra estilista`,
    );
  }
  if (canceladas > 0) {
    const sujeto = movidas > 0 ? '' : canceladas === 1 ? ' cita' : ' citas';
    partes.push(
      `${canceladas}${sujeto} ${canceladas === 1 ? 'se cancela' : 'se cancelan'}`,
    );
  }
  return partes.join(' y ');
}

/** La hora de una cita, en 12 h y en la zona del salón. */
export function horaDeLaCita(instante: Date): string {
  return fechaYHoraEnPalabras(instante.toISOString()).hora;
}

/** Vista previa: `10:00 a. m. · clienta · pasa a [nueva]` o `· se cancela`. */
export function lineaDeVistaPrevia(i: AbsenceImpact): string {
  const que =
    i.outcome === 'reasignada' ? `pasa a ${i.newWorkerName}` : 'se cancela';
  return `${horaDeLaCita(i.scheduledAt)} · ${i.customerName} · ${que}`;
}

/** Ya aplicada: `10:00 a. m. · clienta · pasa a [nueva]` o `· cancelada, avísale`. */
export function lineaAplicada(i: AbsenceImpact): string {
  const que =
    i.outcome === 'reasignada'
      ? `pasa a ${i.newWorkerName}`
      : 'cancelada, avísale';
  return `${horaDeLaCita(i.scheduledAt)} · ${i.customerName} · ${que}`;
}

/** Una cita que no se pudo mover ni cancelar: la dueña la resuelve a mano. */
export const REVISALA = 'revísala en la bandeja';

import { InvalidAbsenceError } from './errors';
import { getDayBounds, salonLocalToUtcIso } from '../salon-time';

const HHMM = /^\d{2}:\d{2}$/;

function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function aHhmm(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Ausencia de una estilista: un tramo de un solo día, de día completo o de una
 * franja alineada a 30 minutos. Los instantes se guardan en UTC; el horario del
 * día (y los festivos) salen de `getDayBounds`, la misma puerta que usan las
 * reservas, para no duplicar el calendario del salón.
 */
export class WorkerAbsence {
  private constructor(
    readonly id: string | null,
    readonly workerId: string,
    readonly startsAt: Date,
    readonly endsAt: Date,
  ) {}

  static create(input: {
    workerId: string;
    dateYmd: string;
    from?: string;
    to?: string;
    now: Date;
    tz: string;
  }): WorkerAbsence {
    const { workerId, dateYmd, from, to, now, tz } = input;
    if ((from === undefined) !== (to === undefined)) {
      throw new InvalidAbsenceError(
        'indica la hora de inicio y la de fin, o ninguna',
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
      throw new InvalidAbsenceError('la fecha debe ser AAAA-MM-DD');
    }
    const { openMin, closeMin } = getDayBounds(dateYmd, tz);

    let desde = openMin;
    let hasta = closeMin;
    if (from !== undefined && to !== undefined) {
      if (!HHMM.test(from) || !HHMM.test(to)) {
        throw new InvalidAbsenceError('las horas deben ser HH:mm');
      }
      desde = minutosDe(from);
      hasta = minutosDe(to);
      if (desde % 30 !== 0 || hasta % 30 !== 0) {
        throw new InvalidAbsenceError('las horas deben ser en punto o y media');
      }
      if (desde >= hasta) {
        throw new InvalidAbsenceError(
          'la hora de inicio debe ser anterior a la de fin',
        );
      }
      if (desde < openMin || hasta > closeMin) {
        throw new InvalidAbsenceError(
          'la franja queda fuera del horario del salón',
        );
      }
    }

    const inicio = salonLocalToUtcIso(dateYmd, aHhmm(desde), tz);
    const fin = salonLocalToUtcIso(dateYmd, aHhmm(hasta), tz);
    if (!inicio || !fin) throw new InvalidAbsenceError('la fecha no existe');

    const endsAt = new Date(fin);
    // Hoy vale mientras el fin no haya pasado, aunque el inicio sí.
    if (endsAt.getTime() <= now.getTime()) {
      throw new InvalidAbsenceError('esa franja ya pasó');
    }
    return new WorkerAbsence(null, workerId, new Date(inicio), endsAt);
  }

  static fromPersistence(p: {
    id: string;
    workerId: string;
    startsAt: Date;
    endsAt: Date;
  }): WorkerAbsence {
    return new WorkerAbsence(p.id, p.workerId, p.startsAt, p.endsAt);
  }

  /** Cruce de intervalos semiabiertos: tocarse en un extremo no es cruzarse. */
  overlaps(start: Date, end: Date): boolean {
    return this.startsAt < end && start < this.endsAt;
  }
}

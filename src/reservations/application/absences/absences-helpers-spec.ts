import { Reservation } from '../../domain/reservation';
import { WorkerAbsence } from '../../domain/worker-absence';
import { AbsenceOverlapError } from '../../domain/errors';
import { AbsencePlan } from './absence-planner';

export const TZ = 'America/Bogota';
export const NOW = new Date('2030-03-11T15:00:00Z');
export const utc = (hhmm: string) => new Date(`2030-03-12T${hhmm}:00-05:00`);

export function cita(
  id: string,
  desde: string,
  minutos = 60,
  workerId = 'ausente',
): Reservation {
  return Reservation.fromPersistence({
    id,
    scheduledAt: utc(desde),
    endedAt: new Date(utc(desde).getTime() + minutos * 60_000),
    workerId,
    workerPinned: false,
    status: 'pendiente' as never,
    contact: { name: 'Clienta Prueba', phone: '+573001112233' },
    lines: [
      { serviceId: 's1', name: 'Corte', price: 1, durationMinutes: minutos },
    ],
  });
}

export function plan(impacts: AbsencePlan['impacts']): AbsencePlan {
  const a = WorkerAbsence.create({
    workerId: 'ausente',
    dateYmd: '2030-03-12',
    now: NOW,
    tz: TZ,
  });
  return {
    workerId: 'ausente',
    workerName: 'Estilista A',
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    impacts,
  };
}

/** Repositorio de ausencias en memoria con el mismo contrato de cruce. */
export function repoAusencias() {
  const filas: WorkerAbsence[] = [];
  return {
    filas,
    save: jest.fn(async (a: WorkerAbsence) => {
      if (
        filas.some(
          (f) => f.workerId === a.workerId && f.overlaps(a.startsAt, a.endsAt),
        )
      ) {
        throw new AbsenceOverlapError();
      }
      const g = WorkerAbsence.fromPersistence({
        id: `abs-${filas.length + 1}`,
        workerId: a.workerId,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
      });
      filas.push(g);
      return g;
    }),
    overlapsAny: jest.fn(async (w: string, s: Date, e: Date) =>
      filas.some((f) => f.workerId === w && f.overlaps(s, e)),
    ),
    delete: jest.fn(async (id: string) => {
      const i = filas.findIndex((f) => f.id === id);
      if (i < 0) return false;
      filas.splice(i, 1);
      return true;
    }),
    listUpcoming: jest.fn(async (now: Date) =>
      filas.filter((f) => f.endsAt > now),
    ),
    findById: jest.fn(
      async (id: string) => filas.find((f) => f.id === id) ?? null,
    ),
  };
}

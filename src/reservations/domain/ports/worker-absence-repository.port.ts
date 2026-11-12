import { WorkerAbsence } from '../worker-absence';

export interface WorkerAbsenceRepositoryPort {
  /** Lanza `AbsenceOverlapError` si choca con otra de la misma estilista. */
  save(a: WorkerAbsence): Promise<WorkerAbsence>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<WorkerAbsence | null>;
  /** Las que aún no terminaron (`endsAt > now`), por `startsAt`. */
  listUpcoming(now: Date): Promise<WorkerAbsence[]>;
  overlapsAny(workerId: string, start: Date, end: Date): Promise<boolean>;
  /** Tramos del día (hora del salón) en minutos desde la medianoche. */
  blocksForDate(
    dateYmd: string,
    tz: string,
  ): Promise<{ workerId: string; startMin: number; endMin: number }[]>;
  /** Minutos ausentes por estilista y día, en el rango [fromYmd, toYmd]. */
  minutesByWorkerAndDate(
    fromYmd: string,
    toYmd: string,
    tz: string,
  ): Promise<{ workerId: string; dateYmd: string; minutes: number }[]>;
}

import { Reservation } from '../reservation';

/** Fila cruda para el cálculo de ocupación (una por reserva en el rango). */
export interface OccupancyMinuteRow {
  dateKey: string; // 'YYYY/MM/DD' en TZ del salón
  startMin: number; // minutos desde medianoche
  durationMin: number;
}

/** Read model del listado admin (incluye datos del estilista). */
export interface ReservationView {
  id: string;
  scheduledAt: Date;
  endedAt: Date;
  workerId: string;
  totalDurationMinutes: number;
  worker: { id: string; name: string; isDefault: boolean };
}

export interface ReservationRepositoryPort {
  save(reservation: Reservation): Promise<Reservation>;
  countOverlaps(
    workerId: string,
    scheduledAt: Date,
    endedAt: Date,
  ): Promise<number>;
  findActiveWithWorker(now: Date): Promise<ReservationView[]>;
  findOccupancyRows(
    fromYmd: string,
    toYmd: string,
    tz: string,
  ): Promise<OccupancyMinuteRow[]>;
  deleteById(id: string): Promise<boolean>;
  deleteEndedBefore(cutoff: Date): Promise<void>;
}

import { Reservation } from '../reservation';

/** Fila cruda para el cálculo de ocupación (una por reserva en el rango). */
export interface OccupancyMinuteRow {
  dateKey: string; // 'YYYY/MM/DD' en TZ del salón
  startMin: number; // minutos desde medianoche
  durationMin: number;
}

/** Read model de reservas (listado admin y "mis reservas"). */
export interface ReservationView {
  id: string;
  scheduledAt: Date;
  endedAt: Date;
  workerId: string;
  totalDurationMinutes: number;
  status: string;
  userId: string | null;
  contact: { name: string; phone: string; email?: string | null } | null;
  worker: { id: string; name: string; isDefault: boolean };
  services: {
    serviceId: string | null;
    name: string;
    price: number;
    durationMinutes: number;
  }[];
}

export interface ReservationRepositoryPort {
  save(reservation: Reservation): Promise<Reservation>;
  findById(id: string): Promise<Reservation | null>;
  countOverlaps(
    workerId: string,
    scheduledAt: Date,
    endedAt: Date,
  ): Promise<number>;
  findActiveWithWorker(now: Date): Promise<ReservationView[]>;
  findByUser(userId: string): Promise<ReservationView[]>;
  findOccupancyRows(
    fromYmd: string,
    toYmd: string,
    tz: string,
  ): Promise<OccupancyMinuteRow[]>;
  /** Marca `cumplida` las reservas activas cuya ventana ya terminó. Devuelve el nº afectado. */
  markFulfilledEndedBefore(now: Date): Promise<number>;
  deleteEndedBefore(cutoff: Date): Promise<void>;
}

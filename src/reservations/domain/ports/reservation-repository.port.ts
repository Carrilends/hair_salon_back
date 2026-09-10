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
  /**
   * Reservas no canceladas del estilista cuya ventana se cruza con la dada.
   *
   * `excludeReservationId` existe para la reprogramación: la reserva que se está
   * moviendo ya está persistida, así que sin excluirla se contaría a sí misma
   * como solape y ningún cambio de hora sería posible. Al crear no se pasa,
   * porque todavía no hay id.
   */
  countOverlaps(
    workerId: string,
    scheduledAt: Date,
    endedAt: Date,
    excludeReservationId?: string,
  ): Promise<number>;
  findActiveWithWorker(now: Date): Promise<ReservationView[]>;
  findByUser(userId: string): Promise<ReservationView[]>;
  findOccupancyRows(
    fromYmd: string,
    toYmd: string,
    tz: string,
  ): Promise<OccupancyMinuteRow[]>;
  /**
   * Salda las reservas cuya ventana ya terminó: las confirmadas pasan a
   * `cumplida` y las pendientes (nunca confirmadas) a `cancelada`. Devuelve el
   * número total de filas afectadas.
   */
  settlePastReservations(now: Date): Promise<number>;
  deleteEndedBefore(cutoff: Date): Promise<void>;
}

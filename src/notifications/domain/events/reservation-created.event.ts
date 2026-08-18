/**
 * El "qué pasó", en datos planos. No arrastra la entidad `Reservation` del
 * contexto de Reservas: si lo hiciera, el módulo de notificaciones dependería
 * de aquél y se perdería el desacople entre contextos.
 */
export interface ReservationCreatedEvent {
  type: 'reservation.created';
  reservationId: string;
  scheduledAt: Date;
  endedAt: Date;
  workerName: string;
  customerName: string;
  customerPhone: string | null;
  services: { name: string; price: number; durationMinutes: number }[];
  totalDurationMinutes: number;
  totalPrice: number;
  status: string;
}

export type NotifiableEvent = ReservationCreatedEvent;

/**
 * Lo que le pasa a una reserva, en datos planos. No arrastra la entidad
 * `Reservation` del contexto de Reservas: si lo hiciera, el módulo de
 * notificaciones dependería de aquél y se perdería el desacople entre contextos.
 *
 * Es una **unión discriminada por `type`**. Todo lo común vive en la base, y en
 * particular `reservationId`, del que depende el registro de fallos del
 * despachador: cualquier miembro nuevo debe seguir teniéndolo.
 *
 * Al ampliarla hay que recordar que el despachador entrega **todos** los eventos
 * a **todos** los canales: un notificador que no discrimine por `type` compondrá
 * el mensaje equivocado para un evento que no esperaba.
 */
export interface ReservationEventBase {
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

export interface ReservationCreatedEvent extends ReservationEventBase {
  type: 'reservation.created';
}

export interface ReservationCancelledEvent extends ReservationEventBase {
  /**
   * `byAdmin` decide a quién se le cuenta qué: la clienta solo recibe aviso de
   * los cambios que hizo la peluquería, porque los suyos ya se los confirmó el
   * canal por el que los hizo. La dueña recibe siempre.
   */
  type: 'reservation.cancelled';
  byAdmin: boolean;
}

export interface ReservationRescheduledEvent extends ReservationEventBase {
  type: 'reservation.rescheduled';
  byAdmin: boolean;
  /** Dónde estaba la cita antes de moverla; el aviso muestra antes → después. */
  previousScheduledAt: Date;
  /**
   * ¿Cambió la persona que la atiende? Desde que mover una cita sin estilista
   * elegida la reparte de nuevo, `byAdmin` ya no basta para decidir si a la
   * clienta hay que contarle algo: puede haberla movido ella y aun así acabar
   * con otra estilista. Es un motivo **añadido**, no un sustituto.
   *
   * No lleva nombres: el nombre efectivo ya viaja en `workerName`, que es el
   * único que las plantillas usan (minimización de datos).
   */
  workerChanged: boolean;
}

/**
 * Confirmar es siempre acción de la peluquería (desde el panel o desde su
 * WhatsApp), así que no lleva `byAdmin`: no hay ambigüedad sobre quién fue. Es
 * el aviso que la clienta más espera —«tu cita quedó confirmada»— y hasta ahora
 * no existía: confirmar era mudo.
 */
export interface ReservationConfirmedEvent extends ReservationEventBase {
  type: 'reservation.confirmed';
}

export type NotifiableEvent =
  | ReservationCreatedEvent
  | ReservationCancelledEvent
  | ReservationRescheduledEvent
  | ReservationConfirmedEvent;

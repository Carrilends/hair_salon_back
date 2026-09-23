import { Reservation } from '../reservation';

/**
 * Puerto de salida propio de Reservas (decisión N7). Reservas habla su idioma
 * —"una reserva fue creada"— y un adaptador de infraestructura traduce eso al
 * módulo compartido de notificaciones. Así el dominio de Reservas no depende
 * del vocabulario de otro contexto.
 */
export interface ReservationNotifierPort {
  reservationCreated(reservation: Reservation): Promise<void>;
  /**
   * `byAdmin` viaja en el aviso porque decide a quién se le cuenta qué: la
   * clienta solo recibe los cambios que hizo la peluquería; los suyos ya se los
   * confirmó el canal por el que los hizo.
   */
  reservationCancelled(
    reservation: Reservation,
    meta: { byAdmin: boolean },
  ): Promise<void>;
  /**
   * `workerChanged` es el **tercer motivo** para avisar a la clienta, junto a
   * `byAdmin`. Reasignar al mover cambia algo que ella no pidió —la persona que
   * la atiende—, y enterarse el día de la cita es el fallo caro. Solo el caso de
   * uso conoce el antes y el después, así que el dato nace allí y viaja aquí.
   */
  reservationRescheduled(
    reservation: Reservation,
    meta: {
      byAdmin: boolean;
      previousScheduledAt: Date;
      workerChanged: boolean;
    },
  ): Promise<void>;
  /** Siempre la hace la peluquería; no hay `byAdmin` que decidir. */
  reservationConfirmed(reservation: Reservation): Promise<void>;
}

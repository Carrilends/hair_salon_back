import { Reservation } from '../reservation';

/**
 * Puerto de salida propio de Reservas (decisión N7). Reservas habla su idioma
 * —"una reserva fue creada"— y un adaptador de infraestructura traduce eso al
 * módulo compartido de notificaciones. Así el dominio de Reservas no depende
 * del vocabulario de otro contexto.
 */
export interface ReservationNotifierPort {
  reservationCreated(reservation: Reservation): Promise<void>;
}

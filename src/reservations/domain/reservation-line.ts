/**
 * Línea de servicio de una reserva: snapshot inmutable del servicio al momento
 * de reservar. `serviceId` puede ser null si el servicio se borra del catálogo
 * después; nombre, precio y duración se conservan para preservar el histórico.
 */
export interface ReservationLine {
  serviceId: string | null;
  name: string;
  price: number;
  durationMinutes: number;
}

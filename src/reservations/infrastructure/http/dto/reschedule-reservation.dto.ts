import { IsISO8601 } from 'class-validator';

/**
 * Nueva hora de una cita. Solo eso: reprogramar no rehace la reserva, así que
 * ni los servicios ni el estilista viajan aquí. Con `forbidNonWhitelisted`
 * global, cualquier otro campo devuelve 400.
 */
export class RescheduleReservationDto {
  @IsISO8601()
  scheduledAt: string;
}

import { IsDateString, Matches } from 'class-validator';

/**
 * `GET /workers/availability/week?start=YYYY-MM-DD`. Cualquier día vale: el
 * servicio lo lleva al lunes de su semana.
 *
 * Dos reglas a propósito: `Matches` fija la FORMA (sin hora, con ceros) e
 * `IsDateString({ strict: true })` la FECHA (un 30 de febrero no existe). La
 * consulta de un día (`WorkerAvailabilityQueryDto`) usa `strict: false` y no
 * se toca: la usa el diálogo de reserva.
 */
export class WorkersWeekQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'start must be YYYY-MM-DD' })
  @IsDateString({ strict: true }, { message: 'start must be a real date' })
  start: string;
}

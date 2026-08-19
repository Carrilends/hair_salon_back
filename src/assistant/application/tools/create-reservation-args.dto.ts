import { ArrayMinSize, IsArray, IsISO8601, IsUUID } from 'class-validator';

/**
 * Argumentos que el modelo debe entregar para `crearReserva`. Se validan con
 * `class-validator` (ya en el proyecto) en lugar de añadir una librería de
 * esquemas: salidas estructuradas, nada de interpretar texto libre (§6.2).
 */
export class CreateReservationArgsDto {
  @IsISO8601()
  fechaHoraIso: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  serviciosIds: string[];
}

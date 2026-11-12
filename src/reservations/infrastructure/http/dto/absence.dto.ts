import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

/**
 * Cuerpo de la vista previa y del marcado de una ausencia. `date` es el día
 * del salón (AAAA-MM-DD); `from`/`to` van juntas o ninguna (día completo), y esa
 * pareja la valida el dominio. `strict` rechaza fechas que no existen
 * (2026-02-30) con 400 antes de llegar al calendario del salón.
 */
export class AbsenceDto {
  @IsUUID()
  workerId: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'from must be HH:mm' })
  from?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, { message: 'to must be HH:mm' })
  to?: string;
}

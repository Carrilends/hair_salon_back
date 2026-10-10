import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

/**
 * Cuerpo de `PATCH /api/faqs/orden`: los ids de TODAS las preguntas, en el
 * orden en que las clientas deben verlas.
 *
 * Aquí solo se valida la forma. Que sean exactamente las preguntas que hay en
 * la base lo comprueba `FaqsService.reordenar`, que es quien las conoce.
 * El tope de 500 no es una regla de negocio: evita que un cuerpo desmesurado
 * llegue a abrir una transacción.
 */
export class ReordenarFaqsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];
}

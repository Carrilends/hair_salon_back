import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import {
  DomainError,
  OutOfBusinessHoursError,
  ReservationNotFoundError,
  WorkerOverlapError,
} from '../../domain/errors';

/**
 * Traduce los errores de dominio de Reservas a excepciones HTTP, preservando
 * los códigos que exponía el servicio monolítico:
 *   - WorkerOverlapError        -> 409 Conflict
 *   - ReservationNotFoundError  -> 404 Not Found
 *   - resto de errores de dominio (horario/entrada inválida) -> 400 Bad Request
 */
@Catch(DomainError)
export class ReservationDomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    let http: HttpException;
    if (error instanceof WorkerOverlapError) {
      http = new ConflictException(error.message);
    } else if (error instanceof ReservationNotFoundError) {
      http = new NotFoundException(error.message);
    } else if (error instanceof OutOfBusinessHoursError) {
      http = new BadRequestException(error.message);
    } else {
      http = new BadRequestException(error.message);
    }
    const res = host.switchToHttp().getResponse();
    res.status(http.getStatus()).json(http.getResponse());
  }
}

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
  CancellationTooLateError,
  DomainError,
  ReservationNotFoundError,
  WorkerOverlapError,
} from '../../domain/errors';

/**
 * Traduce los errores de dominio de Reservas a excepciones HTTP:
 *   - WorkerOverlapError / CancellationTooLateError -> 409 Conflict
 *   - ReservationNotFoundError                      -> 404 Not Found
 *   - resto de errores de dominio (horario, transición de estado inválida,
 *     servicios/contacto faltantes, entrada inválida) -> 400 Bad Request
 */
@Catch(DomainError)
export class ReservationDomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    let http: HttpException;
    if (
      error instanceof WorkerOverlapError ||
      error instanceof CancellationTooLateError
    ) {
      http = new ConflictException(error.message);
    } else if (error instanceof ReservationNotFoundError) {
      http = new NotFoundException(error.message);
    } else {
      http = new BadRequestException(error.message);
    }
    const res = host.switchToHttp().getResponse();
    res.status(http.getStatus()).json(http.getResponse());
  }
}

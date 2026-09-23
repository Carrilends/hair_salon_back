import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import {
  CancellationTooLateError,
  ChosenWorkerBusyError,
  DomainError,
  ReservationNotFoundError,
  ReservationOwnershipError,
  WorkerOverlapError,
} from '../../domain/errors';

/**
 * Traduce los errores de dominio de Reservas a excepciones HTTP:
 *   - WorkerOverlapError / CancellationTooLateError -> 409 Conflict
 *   - ReservationNotFoundError                      -> 404 Not Found
 *   - ReservationOwnershipError                     -> 403 Forbidden
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
    } else if (error instanceof ReservationOwnershipError) {
      http = new ForbiddenException(error.message);
    } else {
      http = new BadRequestException(error.message);
    }
    const res = host.switchToHttp().getResponse();
    const cuerpo = http.getResponse();
    const reason = motivoDelConflicto(error);
    res
      .status(http.getStatus())
      .json(
        reason && typeof cuerpo === 'object' ? { ...cuerpo, reason } : cuerpo,
      );
  }
}

/**
 * Código estable del motivo del 409, para que el portal pueda decirle a la
 * clienta cuál de los dos remedios le sirve: si la ocupada es **su** estilista
 * cabe cambiar de hora o reservar sin preferencia; si el salón está lleno, solo
 * cambiar de hora.
 *
 * Viaja como código y no como texto a propósito: el mensaje se reescribe, se
 * acorta y se traduce, y el día que alguien lo retoque el portal empezaría a
 * contar la historia equivocada sin que ninguna prueba se entere.
 *
 * El `instanceof` específico va ANTES que el genérico porque
 * `ChosenWorkerBusyError` hereda de `WorkerOverlapError`; al revés, el genérico
 * se los comería a los dos.
 */
function motivoDelConflicto(error: DomainError): string | null {
  if (error instanceof ChosenWorkerBusyError) return 'estilista_ocupada';
  if (error instanceof WorkerOverlapError) return 'hora_ocupada';
  return null;
}

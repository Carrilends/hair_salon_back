import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AccountDeletionConfirmationError,
  AdminAccountDeletionError,
  AuthDomainError,
  AuthTokenAlreadyUsedError,
  AuthTokenNotFoundError,
  ExpiredAuthTokenError,
  InactiveUserError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenReuseDetectedError,
  TooManyAttemptsError,
  UserNotFoundError,
} from '../../domain/errors';

/**
 * Traduce los errores de dominio de Auth a excepciones HTTP:
 *   - InvalidCredentialsError / InactiveUserError -> 401 Unauthorized
 *   - UserNotFoundError                           -> 404 Not Found
 *   - AdminAccountDeletionError                   -> 403 Forbidden
 *   - AccountDeletionConfirmationError            -> 422 Unprocessable Entity
 *     (confirmación mala al eliminar la cuenta; no 401, que el portal lee como
 *     sesión caducada y renueva)
 *   - TooManyAttemptsError                        -> 429 Too Many Requests
 *   - resto (correo inválido/duplicado, mismo correo/contraseña, correo ya
 *     verificado y todos los errores de token: inexistente/expirado/usado) -> 400
 *
 * Los tres errores de token se mapean todos a 400 a propósito: tratarlos
 * distinto (p. ej. 410 para el expirado) filtraría información sobre el estado
 * del enlace. `###` (decisión documentada en el plan de la Fase 3a.)
 */
@Catch(AuthDomainError)
export class AuthDomainExceptionFilter implements ExceptionFilter {
  catch(error: AuthDomainError, host: ArgumentsHost) {
    let http: HttpException;
    if (
      error instanceof InvalidCredentialsError ||
      error instanceof InactiveUserError ||
      error instanceof InvalidRefreshTokenError ||
      // El reuso se responde igual que una sesión inválida: no confirmar nada a
      // quien esté probando tokens. El detalle queda en el log del servidor.
      error instanceof RefreshTokenReuseDetectedError
    ) {
      http = new UnauthorizedException(error.message);
    } else if (error instanceof UserNotFoundError) {
      http = new NotFoundException(error.message);
    } else if (error instanceof AccountDeletionConfirmationError) {
      http = new UnprocessableEntityException(error.message);
    } else if (error instanceof AdminAccountDeletionError) {
      http = new ForbiddenException(error.message);
    } else if (error instanceof TooManyAttemptsError) {
      http = new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: error.message,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    } else {
      http = new BadRequestException(error.message);
    }
    const res = host.switchToHttp().getResponse();
    const code = this.tokenCode(error);
    const body = http.getResponse();
    // El estado sigue siendo 400; el `code` estable deja al portal decir por qué
    // falló el enlace sin depender del texto del mensaje.
    res
      .status(http.getStatus())
      .json(code && typeof body === 'object' ? { ...body, code } : body);
  }

  private tokenCode(error: AuthDomainError): string | undefined {
    if (error instanceof AuthTokenAlreadyUsedError) return 'TOKEN_USADO';
    if (error instanceof ExpiredAuthTokenError) return 'TOKEN_CADUCADO';
    if (error instanceof AuthTokenNotFoundError) return 'TOKEN_INVALIDO';
    return undefined;
  }
}

import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AuthDomainError,
  InactiveUserError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenReuseDetectedError,
  UserNotFoundError,
} from '../../domain/errors';

/**
 * Traduce los errores de dominio de Auth a excepciones HTTP:
 *   - InvalidCredentialsError / InactiveUserError -> 401 Unauthorized
 *   - UserNotFoundError                           -> 404 Not Found
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
    } else {
      http = new BadRequestException(error.message);
    }
    const res = host.switchToHttp().getResponse();
    res.status(http.getStatus()).json(http.getResponse());
  }
}

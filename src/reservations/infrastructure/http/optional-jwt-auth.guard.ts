import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard de autenticación opcional para `POST /reservations`: si viene un JWT
 * válido, enlaza el usuario (`req.user`); si no viene o es inválido, deja
 * `req.user = null` y permite continuar como reserva anónima. No lanza 401.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: unknown): TUser {
    return (user || null) as TUser;
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

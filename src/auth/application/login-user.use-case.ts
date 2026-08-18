import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../domain/email';
import { InvalidCredentialsError } from '../domain/errors';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { SessionConfig } from './session-config';
import {
  AuthSessionWithRefresh,
  buildAuthSession,
  issueRefreshFor,
} from './auth-session';
import {
  USER_REPOSITORY,
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  REFRESH_TOKEN_REPOSITORY,
  AUTH_CLOCK,
  SESSION_CONFIG,
} from './tokens';

export interface LoginUserCommand {
  email: string;
  password: string;
}

@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuerPort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
    @Inject(SESSION_CONFIG) private readonly sessionConfig: SessionConfig,
  ) {}

  async execute(command: LoginUserCommand): Promise<AuthSessionWithRefresh> {
    let email: Email;
    try {
      email = Email.create(command.email);
    } catch {
      // Un correo malformado se trata como credenciales inválidas (401), no como
      // error de validación (400): no revelar por qué falló.
      throw new InvalidCredentialsError();
    }

    const user = await this.users.findByEmail(email);
    // Mismo error tanto si el correo no existe como si la contraseña no coincide.
    if (!user) throw new InvalidCredentialsError();
    // S8: una cuenta creada solo con Google no tiene contraseña local. Se rechaza
    // con el mismo error genérico, sin revelar que existe ni que es de Google.
    if (!user.passwordHash) throw new InvalidCredentialsError();
    if (!(await this.hasher.compare(command.password, user.passwordHash)))
      throw new InvalidCredentialsError();

    user.assertCanAuthenticate();

    const refreshToken = await issueRefreshFor(
      user,
      this.issuer,
      this.refreshTokens,
      this.clock.now(),
      this.sessionConfig.refreshTtlDays,
    );
    return { session: buildAuthSession(user, this.issuer), refreshToken };
  }
}

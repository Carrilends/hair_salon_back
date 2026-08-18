import { Inject, Injectable } from '@nestjs/common';
import { AuthTokenType } from '../domain/auth-token-type';
import { AuthTokenNotFoundError } from '../domain/errors';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { AuthTokenRepositoryPort } from '../domain/ports/auth-token-repository.port';
import { PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { SecureTokenGeneratorPort } from '../domain/ports/secure-token-generator.port';
import { ClockPort } from '../domain/ports/clock.port';
import { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import {
  USER_REPOSITORY,
  AUTH_TOKEN_REPOSITORY,
  PASSWORD_HASHER,
  SECURE_TOKEN_GENERATOR,
  AUTH_CLOCK,
  REFRESH_TOKEN_REPOSITORY,
} from './tokens';

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_TOKEN_REPOSITORY)
    private readonly authTokens: AuthTokenRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(SECURE_TOKEN_GENERATOR)
    private readonly generator: SecureTokenGeneratorPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepositoryPort,
  ) {}

  async execute(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.generator.hash(rawToken);
    const token = await this.authTokens.findByHash(
      AuthTokenType.PasswordReset,
      tokenHash,
    );
    if (!token) throw new AuthTokenNotFoundError();

    const now = this.clock.now();
    // Propaga ExpiredAuthTokenError / AuthTokenAlreadyUsedError.
    token.assertUsable(now);

    const user = await this.users.findById(token.userId);
    // No revelar más: un usuario ausente/inactivo se trata como token inválido.
    if (!user || !user.isActive) throw new AuthTokenNotFoundError();

    user.changePasswordHash(await this.hasher.hash(newPassword));
    await this.users.save(user);

    token.markUsed(now);
    await this.authTokens.save(token);
    await this.authTokens.invalidateAllOfType(
      token.userId,
      AuthTokenType.PasswordReset,
      now,
    );
    // Cambiar la contraseña invalida todas las sesiones abiertas: es lo que
    // espera quien restablece porque cree que le robaron la cuenta (Fase 3b).
    await this.refreshTokens.revokeAllOfUser(user.id!, now);
  }
}

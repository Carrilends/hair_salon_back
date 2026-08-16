import { Inject, Injectable } from '@nestjs/common';
import { AuthTokenType } from '../domain/auth-token-type';
import { AuthTokenNotFoundError } from '../domain/errors';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { AuthTokenRepositoryPort } from '../domain/ports/auth-token-repository.port';
import { SecureTokenGeneratorPort } from '../domain/ports/secure-token-generator.port';
import { ClockPort } from '../domain/ports/clock.port';
import {
  USER_REPOSITORY,
  AUTH_TOKEN_REPOSITORY,
  SECURE_TOKEN_GENERATOR,
  AUTH_CLOCK,
} from './tokens';

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_TOKEN_REPOSITORY)
    private readonly authTokens: AuthTokenRepositoryPort,
    @Inject(SECURE_TOKEN_GENERATOR)
    private readonly generator: SecureTokenGeneratorPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(rawToken: string): Promise<void> {
    const tokenHash = this.generator.hash(rawToken);
    const token = await this.authTokens.findByHash(
      AuthTokenType.EmailVerification,
      tokenHash,
    );
    if (!token) throw new AuthTokenNotFoundError();

    const now = this.clock.now();
    token.assertUsable(now);

    const user = await this.users.findById(token.userId);
    if (!user) throw new AuthTokenNotFoundError();

    // Idempotente: si ya estaba verificada, se consume el token igualmente y se
    // responde con éxito, en vez de fallar ante un doble clic en el enlace.
    if (!user.isEmailVerified) {
      user.verifyEmail(now);
      await this.users.save(user);
    }

    token.markUsed(now);
    await this.authTokens.save(token);
  }
}

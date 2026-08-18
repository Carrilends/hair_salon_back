import { Inject, Injectable, Logger } from '@nestjs/common';
import { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { ClockPort } from '../domain/ports/clock.port';
import {
  InvalidRefreshTokenError,
  RefreshTokenReuseDetectedError,
} from '../domain/errors';
import { RefreshToken } from '../domain/refresh-token';
import { AuthSessionWithRefresh, buildAuthSession } from './auth-session';
import {
  REFRESH_TOKEN_REPOSITORY,
  USER_REPOSITORY,
  TOKEN_ISSUER,
  AUTH_CLOCK,
} from './tokens';

@Injectable()
export class RefreshSessionUseCase {
  private readonly logger = new Logger(RefreshSessionUseCase.name);

  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly tokens: RefreshTokenRepositoryPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuerPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(rawRefreshToken: string): Promise<AuthSessionWithRefresh> {
    const now = this.clock.now();
    const stored = await this.tokens.findByHash(
      this.issuer.hashRefreshToken(rawRefreshToken),
    );
    if (!stored) throw new InvalidRefreshTokenError();

    try {
      stored.assertUsable(now);
    } catch (error) {
      if (error instanceof RefreshTokenReuseDetectedError) {
        // Alguien presentó un token ya rotado: se corta la sesión entera (S2).
        const revoked = await this.tokens.revokeFamily(stored.familyId, now);
        this.logger.warn(
          `Reuso de refresh token detectado (usuario ${stored.userId}); ${revoked} tokens revocados`,
        );
      }
      throw error;
    }

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive) throw new InvalidRefreshTokenError();

    const next = this.issuer.issueRefreshToken();
    const issued: RefreshToken = stored.rotate({ tokenHash: next.hash, now });
    await this.tokens.saveRotation(stored, issued);

    return {
      session: buildAuthSession(user, this.issuer),
      refreshToken: next.raw,
    };
  }
}

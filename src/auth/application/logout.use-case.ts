import { Inject, Injectable } from '@nestjs/common';
import { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { ClockPort } from '../domain/ports/clock.port';
import { REFRESH_TOKEN_REPOSITORY, TOKEN_ISSUER, AUTH_CLOCK } from './tokens';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly tokens: RefreshTokenRepositoryPort,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuerPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
  ) {}

  /**
   * Revoca el token presentado (revocación limpia, no rotación: no dispara la
   * detección de reuso). Cerrar sesión nunca debe fallar: si el token ya no
   * existe se resuelve en silencio.
   */
  async execute(rawRefreshToken: string): Promise<void> {
    const stored = await this.tokens.findByHash(
      this.issuer.hashRefreshToken(rawRefreshToken),
    );
    if (!stored) return;
    const now = this.clock.now();
    stored.revoke(now);
    await this.tokens.save(stored);
  }
}

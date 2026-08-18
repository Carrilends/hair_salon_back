import { Inject, Injectable } from '@nestjs/common';
import { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { REFRESH_TOKEN_REPOSITORY, AUTH_CLOCK } from './tokens';

@Injectable()
export class LogoutAllUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly tokens: RefreshTokenRepositoryPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
  ) {}

  /** Cierra la sesión en todos los dispositivos del usuario. */
  async execute(userId: string): Promise<number> {
    return this.tokens.revokeAllOfUser(userId, this.clock.now());
  }
}

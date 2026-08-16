import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../domain/errors';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { AuthSession, buildAuthSession } from './auth-session';
import { USER_REPOSITORY, TOKEN_ISSUER } from './tokens';

@Injectable()
export class GetAuthStatusUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuerPort,
  ) {}

  async execute(userId: string): Promise<AuthSession> {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundError();
    return buildAuthSession(user, this.issuer);
  }
}

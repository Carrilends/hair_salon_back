import { Inject, Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../domain/errors';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { ReviewAuthorRenamerPort } from '../domain/ports/review-author-renamer.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { AuthSession, buildAuthSession } from './auth-session';
import { USER_REPOSITORY, REVIEW_AUTHOR_RENAMER, TOKEN_ISSUER } from './tokens';

export interface UpdateProfileCommand {
  fullName: string;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(REVIEW_AUTHOR_RENAMER)
    private readonly reviewRenamer: ReviewAuthorRenamerPort,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuerPort,
  ) {}

  async execute(
    userId: string,
    command: UpdateProfileCommand,
  ): Promise<AuthSession> {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundError();
    user.rename(command.fullName);
    const saved = await this.users.save(user);
    // El renombrado se propaga a las reseñas del autor por un puerto, nunca
    // tocando los repositorios de Reviews desde Auth.
    await this.reviewRenamer.rename(userId, saved.fullName);
    return buildAuthSession(saved, this.issuer);
  }
}

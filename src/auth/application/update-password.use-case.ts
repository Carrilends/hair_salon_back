import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidCredentialsError,
  SamePasswordError,
  UserNotFoundError,
} from '../domain/errors';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { AuthSession, buildAuthSession } from './auth-session';
import { USER_REPOSITORY, PASSWORD_HASHER, TOKEN_ISSUER } from './tokens';

export interface UpdatePasswordCommand {
  currentPassword: string;
  newPassword: string;
}

@Injectable()
export class UpdatePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuerPort,
  ) {}

  async execute(
    userId: string,
    command: UpdatePasswordCommand,
  ): Promise<AuthSession> {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundError();
    if (
      !(await this.hasher.compare(command.currentPassword, user.passwordHash))
    )
      throw new InvalidCredentialsError();
    if (command.currentPassword === command.newPassword)
      throw new SamePasswordError();

    user.changePasswordHash(await this.hasher.hash(command.newPassword));
    const saved = await this.users.save(user);
    return buildAuthSession(saved, this.issuer);
  }
}

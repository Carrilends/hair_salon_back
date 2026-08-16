import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../domain/email';
import { InvalidCredentialsError } from '../domain/errors';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { AuthSession, buildAuthSession } from './auth-session';
import { USER_REPOSITORY, PASSWORD_HASHER, TOKEN_ISSUER } from './tokens';

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
  ) {}

  async execute(command: LoginUserCommand): Promise<AuthSession> {
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
    if (!(await this.hasher.compare(command.password, user.passwordHash)))
      throw new InvalidCredentialsError();

    user.assertCanAuthenticate();
    return buildAuthSession(user, this.issuer);
  }
}

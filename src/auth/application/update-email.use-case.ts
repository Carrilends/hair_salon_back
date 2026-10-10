import { Inject, Injectable, Logger } from '@nestjs/common';
import { Email } from '../domain/email';
import { UserAccount } from '../domain/user-account';
import { AuthToken } from '../domain/auth-token';
import { AuthTokenType, TOKEN_TTL_MINUTES } from '../domain/auth-token-type';
import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  UserNotFoundError,
} from '../domain/errors';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { AuthTokenRepositoryPort } from '../domain/ports/auth-token-repository.port';
import { PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { SecureTokenGeneratorPort } from '../domain/ports/secure-token-generator.port';
import { EmailSenderPort } from 'src/notifications/domain/ports/email-sender.port';
import { ClockPort } from '../domain/ports/clock.port';
import { AuthEmailComposer, AuthLinks } from './auth-email-composer';
import { AuthSession, buildAuthSession } from './auth-session';
import {
  USER_REPOSITORY,
  AUTH_TOKEN_REPOSITORY,
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  SECURE_TOKEN_GENERATOR,
  EMAIL_SENDER,
  AUTH_CLOCK,
  FRONT_BASE_URL,
} from './tokens';

export interface UpdateEmailCommand {
  currentPassword: string;
  newEmail: string;
}

@Injectable()
export class UpdateEmailUseCase {
  private readonly logger = new Logger(UpdateEmailUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_TOKEN_REPOSITORY)
    private readonly authTokens: AuthTokenRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuerPort,
    @Inject(SECURE_TOKEN_GENERATOR)
    private readonly generator: SecureTokenGeneratorPort,
    @Inject(EMAIL_SENDER) private readonly mailer: EmailSenderPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
    @Inject(FRONT_BASE_URL) private readonly links: AuthLinks,
  ) {}

  async execute(
    userId: string,
    command: UpdateEmailCommand,
  ): Promise<AuthSession> {
    const user = await this.users.findById(userId);
    if (!user) throw new UserNotFoundError();
    // Una cuenta creada con Google no tiene contraseña local (S8): no hay nada
    // que comparar. Sin esta guarda, bcrypt rechaza el `null` con un Error que
    // no es de dominio y el borde respondía 500 en vez de 401 (plan 6).
    if (!user.passwordHash) throw new InvalidCredentialsError();
    if (
      !(await this.hasher.compare(command.currentPassword, user.passwordHash))
    )
      throw new InvalidCredentialsError();

    // changeEmail lanza SameEmailError si es el mismo y desverifica la cuenta (E5).
    const nextEmail = Email.create(command.newEmail);
    user.changeEmail(nextEmail);
    // Comprobar la unicidad DESPUÉS de changeEmail: si el usuario reenvía su
    // propio correo recibe SameEmailError, no EmailAlreadyInUseError. Sin esto,
    // el UNIQUE de Postgres lanzaría un error ajeno al dominio → 500 en vez de 400.
    if (await this.users.existsByEmail(nextEmail))
      throw new EmailAlreadyInUseError();
    const saved = await this.users.save(user);
    await this.issueVerification(saved, this.clock.now());
    return buildAuthSession(saved, this.issuer);
  }

  // ### Deuda DRY consciente: idéntica a RegisterUserUseCase#issueVerification.
  private async issueVerification(user: UserAccount, now: Date): Promise<void> {
    // Invalida cualquier verificación previa (regla 4). Crítico aquí: el enlace
    // enviado al correo ANTERIOR no debe poder verificar la cuenta ya migrada.
    await this.authTokens.invalidateAllOfType(
      user.id!,
      AuthTokenType.EmailVerification,
      now,
    );
    const { raw, hash } = this.generator.generate();
    await this.authTokens.save(
      AuthToken.issue({
        userId: user.id!,
        type: AuthTokenType.EmailVerification,
        tokenHash: hash,
        now,
        ttlMinutes: TOKEN_TTL_MINUTES[AuthTokenType.EmailVerification],
      }),
    );
    try {
      await this.mailer.send(
        new AuthEmailComposer(this.links).emailVerification(
          user.email.value,
          user.fullName,
          raw,
        ),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo enviar la verificación a ${user.email.value}`,
        error as Error,
      );
    }
  }
}

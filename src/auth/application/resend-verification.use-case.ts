import { Inject, Injectable, Logger } from '@nestjs/common';
import { Email } from '../domain/email';
import { UserAccount } from '../domain/user-account';
import { AuthToken } from '../domain/auth-token';
import { AuthTokenType, TOKEN_TTL_MINUTES } from '../domain/auth-token-type';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { AuthTokenRepositoryPort } from '../domain/ports/auth-token-repository.port';
import { SecureTokenGeneratorPort } from '../domain/ports/secure-token-generator.port';
import { EmailSenderPort } from '../domain/ports/email-sender.port';
import { ClockPort } from '../domain/ports/clock.port';
import { AuthEmailComposer, AuthLinks } from './auth-email-composer';
import {
  USER_REPOSITORY,
  AUTH_TOKEN_REPOSITORY,
  SECURE_TOKEN_GENERATOR,
  EMAIL_SENDER,
  AUTH_CLOCK,
  FRONT_BASE_URL,
} from './tokens';

@Injectable()
export class ResendVerificationUseCase {
  private readonly logger = new Logger(ResendVerificationUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(AUTH_TOKEN_REPOSITORY)
    private readonly authTokens: AuthTokenRepositoryPort,
    @Inject(SECURE_TOKEN_GENERATOR)
    private readonly generator: SecureTokenGeneratorPort,
    @Inject(EMAIL_SENDER) private readonly mailer: EmailSenderPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
    @Inject(FRONT_BASE_URL) private readonly links: AuthLinks,
  ) {}

  /**
   * Respuesta genérica como en el reset (regla 5): si la cuenta no existe, está
   * inactiva o ya está verificada, no hace nada y resuelve igual.
   */
  async execute(rawEmail: string): Promise<void> {
    let email: Email;
    try {
      email = Email.create(rawEmail);
    } catch {
      return;
    }

    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive || user.isEmailVerified) return;

    await this.issueVerification(user, this.clock.now());
  }

  // ### Deuda DRY consciente: idéntica a RegisterUserUseCase#issueVerification.
  private async issueVerification(user: UserAccount, now: Date): Promise<void> {
    // Invalida cualquier verificación previa (regla 4): un solo enlace vigente.
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
        `No se pudo reenviar la verificación a ${user.email.value}`,
        error as Error,
      );
    }
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Email } from '../domain/email';
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
export class RequestPasswordResetUseCase {
  private readonly logger = new Logger(RequestPasswordResetUseCase.name);

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
   * Siempre resuelve sin valor, exista o no la cuenta: el borde HTTP responde
   * 202 con un mensaje genérico. Es la contramedida contra la enumeración de
   * usuarios (regla 5 del modelo de tokens).
   */
  async execute(rawEmail: string): Promise<void> {
    let email: Email;
    try {
      email = Email.create(rawEmail);
    } catch {
      return;
    }

    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) return;

    const now = this.clock.now();
    await this.authTokens.invalidateAllOfType(
      user.id!,
      AuthTokenType.PasswordReset,
      now,
    );

    const { raw, hash } = this.generator.generate();
    await this.authTokens.save(
      AuthToken.issue({
        userId: user.id!,
        type: AuthTokenType.PasswordReset,
        tokenHash: hash,
        now,
        ttlMinutes: TOKEN_TTL_MINUTES[AuthTokenType.PasswordReset],
      }),
    );

    try {
      await this.mailer.send(
        new AuthEmailComposer(this.links).passwordReset(
          user.email.value,
          user.fullName,
          raw,
        ),
      );
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el restablecimiento a ${user.email.value}`,
        error as Error,
      );
    }
  }
}

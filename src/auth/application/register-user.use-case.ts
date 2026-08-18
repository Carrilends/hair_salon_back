import { Inject, Injectable, Logger } from '@nestjs/common';
import { Email } from '../domain/email';
import { UserAccount } from '../domain/user-account';
import { AuthToken } from '../domain/auth-token';
import { AuthTokenType, TOKEN_TTL_MINUTES } from '../domain/auth-token-type';
import { EmailAlreadyInUseError } from '../domain/errors';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { AuthTokenRepositoryPort } from '../domain/ports/auth-token-repository.port';
import { PasswordHasherPort } from '../domain/ports/password-hasher.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { SecureTokenGeneratorPort } from '../domain/ports/secure-token-generator.port';
import { EmailSenderPort } from 'src/notifications/domain/ports/email-sender.port';
import { ClockPort } from '../domain/ports/clock.port';
import { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import { AuthEmailComposer, AuthLinks } from './auth-email-composer';
import { SessionConfig } from './session-config';
import {
  AuthSessionWithRefresh,
  buildAuthSession,
  issueRefreshFor,
} from './auth-session';
import {
  USER_REPOSITORY,
  AUTH_TOKEN_REPOSITORY,
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  SECURE_TOKEN_GENERATOR,
  EMAIL_SENDER,
  AUTH_CLOCK,
  FRONT_BASE_URL,
  REFRESH_TOKEN_REPOSITORY,
  SESSION_CONFIG,
} from './tokens';

export interface RegisterUserCommand {
  email: string;
  password: string;
  fullName: string;
  dataPolicyAccepted: boolean;
}

@Injectable()
export class RegisterUserUseCase {
  private readonly logger = new Logger(RegisterUserUseCase.name);

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
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(SESSION_CONFIG) private readonly sessionConfig: SessionConfig,
  ) {}

  async execute(command: RegisterUserCommand): Promise<AuthSessionWithRefresh> {
    const email = Email.create(command.email);
    if (await this.users.existsByEmail(email))
      throw new EmailAlreadyInUseError();

    const now = this.clock.now();
    const account = UserAccount.register({
      email,
      passwordHash: await this.hasher.hash(command.password),
      fullName: command.fullName,
      dataPolicyAccepted: command.dataPolicyAccepted,
      now,
    });

    const saved = await this.users.save(account);
    await this.issueVerification(saved, now);

    const refreshToken = await issueRefreshFor(
      saved,
      this.issuer,
      this.refreshTokens,
      now,
      this.sessionConfig.refreshTtlDays,
    );
    return { session: buildAuthSession(saved, this.issuer), refreshToken };
  }

  // ### Deuda DRY consciente: esta rutina se repite en UpdateEmailUseCase y
  // ResendVerificationUseCase. Extraíble a un servicio de aplicación compartido
  // (application/issue-email-verification.service.ts) en una limpieza posterior.
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
      // El registro ya está confirmado en base de datos: un fallo del proveedor
      // de correo no debe abortarlo. El usuario puede pedir el reenvío (RF47).
      this.logger.error(
        `No se pudo enviar la verificación a ${user.email.value}`,
        error as Error,
      );
    }
  }
}

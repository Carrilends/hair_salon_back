import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../domain/email';
import { UserAccount } from '../domain/user-account';
import {
  GoogleAccountNotVerifiedError,
  DataPolicyConsentRequiredError,
} from '../domain/errors';
import { GoogleIdentityPort } from '../domain/ports/google-identity.port';
import { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { SessionConfig } from './session-config';
import {
  AuthSessionWithRefresh,
  buildAuthSession,
  issueRefreshFor,
} from './auth-session';
import {
  GOOGLE_IDENTITY,
  USER_REPOSITORY,
  TOKEN_ISSUER,
  REFRESH_TOKEN_REPOSITORY,
  AUTH_CLOCK,
  SESSION_CONFIG,
} from './tokens';

export interface LoginWithGoogleCommand {
  idToken: string;
  dataPolicyAccepted?: boolean;
}

@Injectable()
export class LoginWithGoogleUseCase {
  constructor(
    @Inject(GOOGLE_IDENTITY) private readonly google: GoogleIdentityPort,
    @Inject(USER_REPOSITORY) private readonly users: UserRepositoryPort,
    @Inject(TOKEN_ISSUER) private readonly issuer: TokenIssuerPort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(AUTH_CLOCK) private readonly clock: ClockPort,
    @Inject(SESSION_CONFIG) private readonly sessionConfig: SessionConfig,
  ) {}

  async execute(
    command: LoginWithGoogleCommand,
  ): Promise<AuthSessionWithRefresh> {
    const profile = await this.google.verifyIdToken(command.idToken);
    if (!profile.emailVerified) throw new GoogleAccountNotVerifiedError();

    const email = Email.create(profile.email);
    let user = await this.users.findByGoogleId(profile.googleId);

    if (!user) {
      const existing = await this.users.findByEmail(email);
      if (existing) {
        // Vinculación: mismo correo, ya verificado por Google (RF52).
        existing.linkGoogleAccount(profile.googleId, this.clock.now());
        user = await this.users.save(existing);
      } else {
        // Alta nueva: exige consentimiento explícito (S9, Ley 1581 de 2012).
        if (!command.dataPolicyAccepted)
          throw new DataPolicyConsentRequiredError();
        user = await this.users.save(
          UserAccount.registerWithGoogle({
            email,
            googleId: profile.googleId,
            fullName: profile.fullName,
            now: this.clock.now(),
          }),
        );
      }
    }

    user.assertCanAuthenticate();

    const refreshToken = await issueRefreshFor(
      user,
      this.issuer,
      this.refreshTokens,
      this.clock.now(),
      this.sessionConfig.refreshTtlDays,
    );
    return { session: buildAuthSession(user, this.issuer), refreshToken };
  }
}

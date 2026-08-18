import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { NotificationsModule } from 'src/notifications/notifications.module';
import { parseDurationSeconds } from './infrastructure/security/parse-duration-seconds';

import { User } from './entities/user.entity';
import { Review } from 'src/reviews/entities/review.entity';
import { ReviewByUser } from 'src/reviews/entities/review-by-user.entity';
import { JWTStrategy } from './strategies/jwt.strategy';

import { AuthController } from './infrastructure/http/auth.controller';
import { AuthTokenOrmEntity } from './infrastructure/persistence/auth-token.orm-entity';
import { RefreshTokenOrmEntity } from './infrastructure/persistence/refresh-token.orm-entity';

// Casos de uso (aplicación)
import { RegisterUserUseCase } from './application/register-user.use-case';
import { LoginUserUseCase } from './application/login-user.use-case';
import { GetAuthStatusUseCase } from './application/get-auth-status.use-case';
import { UpdateProfileUseCase } from './application/update-profile.use-case';
import { UpdateEmailUseCase } from './application/update-email.use-case';
import { UpdatePasswordUseCase } from './application/update-password.use-case';
import { RequestPasswordResetUseCase } from './application/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/reset-password.use-case';
import { VerifyEmailUseCase } from './application/verify-email.use-case';
import { ResendVerificationUseCase } from './application/resend-verification.use-case';
import { RefreshSessionUseCase } from './application/refresh-session.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { LogoutAllUseCase } from './application/logout-all.use-case';
import { LoginWithGoogleUseCase } from './application/login-with-google.use-case';
import { AuthLinks } from './application/auth-email-composer';
import { SessionConfig } from './application/session-config';

// Adaptadores (infraestructura)
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm-user.repository';
import { TypeOrmAuthTokenRepository } from './infrastructure/persistence/typeorm-auth-token.repository';
import { TypeOrmRefreshTokenRepository } from './infrastructure/persistence/typeorm-refresh-token.repository';
import { BcryptPasswordHasherAdapter } from './infrastructure/security/bcrypt-password-hasher.adapter';
import { CryptoTokenGeneratorAdapter } from './infrastructure/security/crypto-token-generator.adapter';
import { JwtTokenIssuerAdapter } from './infrastructure/security/jwt-token-issuer.adapter';
import { GoogleIdentityAdapter } from './infrastructure/security/google-identity.adapter';
import { ReviewAuthorRenamerAdapter } from './infrastructure/reviews/review-author-renamer.adapter';
import { SystemClockAdapter } from './infrastructure/time/system-clock.adapter';

// Tokens de inyección
import {
  USER_REPOSITORY,
  AUTH_TOKEN_REPOSITORY,
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  SECURE_TOKEN_GENERATOR,
  REVIEW_AUTHOR_RENAMER,
  AUTH_CLOCK,
  FRONT_BASE_URL,
  REFRESH_TOKEN_REPOSITORY,
  GOOGLE_IDENTITY,
  SESSION_CONFIG,
} from './application/tokens';

@Module({
  controllers: [AuthController],
  providers: [
    JWTStrategy,
    // Casos de uso
    RegisterUserUseCase,
    LoginUserUseCase,
    GetAuthStatusUseCase,
    UpdateProfileUseCase,
    UpdateEmailUseCase,
    UpdatePasswordUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    VerifyEmailUseCase,
    ResendVerificationUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    LoginWithGoogleUseCase,
    // Puertos -> adaptadores
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: AUTH_TOKEN_REPOSITORY, useClass: TypeOrmAuthTokenRepository },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useClass: TypeOrmRefreshTokenRepository,
    },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasherAdapter },
    {
      // La vigencia del access token se deriva de JWT_EXPIRES_IN (default 15m,
      // S6): la misma variable firma el JWT y alimenta accessTokenTtlSeconds(),
      // así el cliente sabe cuándo renovar antes de que expire.
      provide: TOKEN_ISSUER,
      useFactory: (jwtService: JwtService) =>
        new JwtTokenIssuerAdapter(
          jwtService,
          parseDurationSeconds(process.env.JWT_EXPIRES_IN ?? '15m'),
        ),
      inject: [JwtService],
    },
    { provide: SECURE_TOKEN_GENERATOR, useClass: CryptoTokenGeneratorAdapter },
    { provide: REVIEW_AUTHOR_RENAMER, useClass: ReviewAuthorRenamerAdapter },
    { provide: AUTH_CLOCK, useClass: SystemClockAdapter },
    {
      // Enlaces del frontend derivados de FRONT_URL (que ya existe para CORS).
      // FRONT_URL puede ser lista separada por comas: se toma el primero.
      provide: FRONT_BASE_URL,
      useFactory: (): AuthLinks => {
        const base = (process.env.FRONT_URL ?? '')
          .split(',')[0]
          .trim()
          .replace(/\/$/, '');
        return {
          resetPasswordUrl: `${base}/auth/restablecer`,
          verifyEmailUrl: `${base}/auth/verificar-correo`,
        };
      },
    },
    {
      // El client id de Google es público (viaja al navegador). Puede faltar en
      // desarrollo sin Google configurado: el módulo arranca igual y solo el
      // inicio de sesión con Google fallaría al verificar el token.
      provide: GOOGLE_IDENTITY,
      useFactory: () =>
        new GoogleIdentityAdapter((process.env.GOOGLE_CLIENT_ID ?? '').trim()),
    },
    {
      // Vigencia del refresh (S6, default 30 días); refreshTtlMs alimenta el
      // maxAge de la cookie.
      provide: SESSION_CONFIG,
      useFactory: (): SessionConfig => {
        const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? '30');
        return {
          refreshTtlDays: days,
          refreshTtlMs: days * 24 * 60 * 60 * 1000,
        };
      },
    },
  ],
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([
      User,
      Review,
      ReviewByUser,
      AuthTokenOrmEntity,
      RefreshTokenOrmEntity,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [],
      useFactory: async () => ({
        secret: process.env.JWT_SECRET,
        // S6: access token corto (15m por defecto). El refresh token en cookie
        // sostiene la sesión; el JWT deja de durar un día.
        signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' },
      }),
    }),
  ],
  // IMPORTANTE: exports idénticos a los previos. Los 11 módulos que importan
  // AuthModule dependen de este contrato (riesgo nº 1 de la fase).
  exports: [TypeOrmModule, JWTStrategy, PassportModule, JwtModule],
})
export class AuthModule {}

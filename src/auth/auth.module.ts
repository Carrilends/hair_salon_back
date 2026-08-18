import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';

import { parseDurationSeconds } from './infrastructure/security/parse-duration-seconds';

import { User } from './entities/user.entity';
import { Review } from 'src/reviews/entities/review.entity';
import { ReviewByUser } from 'src/reviews/entities/review-by-user.entity';
import { JWTStrategy } from './strategies/jwt.strategy';

import { AuthController } from './infrastructure/http/auth.controller';
import { AuthTokenOrmEntity } from './infrastructure/persistence/auth-token.orm-entity';

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
import { AuthLinks } from './application/auth-email-composer';

// Adaptadores (infraestructura)
import { TypeOrmUserRepository } from './infrastructure/persistence/typeorm-user.repository';
import { TypeOrmAuthTokenRepository } from './infrastructure/persistence/typeorm-auth-token.repository';
import { BcryptPasswordHasherAdapter } from './infrastructure/security/bcrypt-password-hasher.adapter';
import { CryptoTokenGeneratorAdapter } from './infrastructure/security/crypto-token-generator.adapter';
import { JwtTokenIssuerAdapter } from './infrastructure/security/jwt-token-issuer.adapter';
import { ConsoleEmailSenderAdapter } from './infrastructure/email/console-email-sender.adapter';
import { ProviderEmailSenderAdapter } from './infrastructure/email/provider-email-sender.adapter';
import { ReviewAuthorRenamerAdapter } from './infrastructure/reviews/review-author-renamer.adapter';
import { SystemClockAdapter } from './infrastructure/time/system-clock.adapter';

// Tokens de inyección
import {
  USER_REPOSITORY,
  AUTH_TOKEN_REPOSITORY,
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  SECURE_TOKEN_GENERATOR,
  EMAIL_SENDER,
  REVIEW_AUTHOR_RENAMER,
  AUTH_CLOCK,
  FRONT_BASE_URL,
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
    // Puertos -> adaptadores
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: AUTH_TOKEN_REPOSITORY, useClass: TypeOrmAuthTokenRepository },
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
      // La elección del transporte de correo es explícita por variable de
      // entorno: sin EMAIL_PROVIDER se usa el adaptador de consola (E3).
      provide: EMAIL_SENDER,
      useFactory: () => {
        const provider = (process.env.EMAIL_PROVIDER ?? '').trim();
        return provider.length > 0
          ? new ProviderEmailSenderAdapter()
          : new ConsoleEmailSenderAdapter();
      },
    },
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
  ],
  imports: [
    TypeOrmModule.forFeature([User, Review, ReviewByUser, AuthTokenOrmEntity]),
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

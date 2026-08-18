import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Auth } from '../../decorators/auth.decorator';
import { GetUser } from '../../decorators/get-user.decorator';
import { User } from '../../entities/user.entity';
import { CreateUserDto } from '../../dto/create-user.dto';
import { LoginUserDto } from '../../dto/login-user.dto';
import { UpdateProfileDto } from '../../dto/update-profile.dto';
import { UpdateEmailDto } from '../../dto/update-email.dto';
import { UpdatePasswordDto } from '../../dto/update-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { AuthDomainExceptionFilter } from './auth-domain-exception.filter';
import {
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  clearRefreshCookie,
} from './session-cookie';
import { RegisterUserUseCase } from '../../application/register-user.use-case';
import { LoginUserUseCase } from '../../application/login-user.use-case';
import { GetAuthStatusUseCase } from '../../application/get-auth-status.use-case';
import { UpdateProfileUseCase } from '../../application/update-profile.use-case';
import { UpdateEmailUseCase } from '../../application/update-email.use-case';
import { UpdatePasswordUseCase } from '../../application/update-password.use-case';
import { RequestPasswordResetUseCase } from '../../application/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../application/reset-password.use-case';
import { VerifyEmailUseCase } from '../../application/verify-email.use-case';
import { ResendVerificationUseCase } from '../../application/resend-verification.use-case';
import { RefreshSessionUseCase } from '../../application/refresh-session.use-case';
import { LogoutUseCase } from '../../application/logout.use-case';
import { LogoutAllUseCase } from '../../application/logout-all.use-case';
import { LoginWithGoogleUseCase } from '../../application/login-with-google.use-case';
import { SESSION_CONFIG } from '../../application/tokens';
import { SessionConfig } from '../../application/session-config';

@Controller('auth')
@UseFilters(AuthDomainExceptionFilter)
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly getAuthStatus: GetAuthStatusUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly updateEmailUseCase: UpdateEmailUseCase,
    private readonly updatePasswordUseCase: UpdatePasswordUseCase,
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    private readonly performPasswordReset: ResetPasswordUseCase,
    private readonly confirmEmail: VerifyEmailUseCase,
    private readonly resendConfirmation: ResendVerificationUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllUseCase: LogoutAllUseCase,
    private readonly loginWithGoogleUseCase: LoginWithGoogleUseCase,
    @Inject(SESSION_CONFIG) private readonly sessionConfig: SessionConfig,
  ) {}

  @Post('register')
  async register(
    @Body() dto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken } = await this.registerUser.execute({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      dataPolicyAccepted: dto.dataPolicyAccepted,
    });
    // El refresh token viaja en cookie httpOnly, nunca en el cuerpo.
    setRefreshCookie(res, refreshToken, this.sessionConfig.refreshTtlMs);
    return session;
  }

  @Post('login')
  async login(
    @Body() dto: LoginUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken } = await this.loginUser.execute({
      email: dto.email,
      password: dto.password,
    });
    setRefreshCookie(res, refreshToken, this.sessionConfig.refreshTtlMs);
    return session;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!raw) throw new UnauthorizedException('Sesión no disponible');
    const { session, refreshToken } = await this.refreshSession.execute(raw);
    setRefreshCookie(res, refreshToken, this.sessionConfig.refreshTtlMs);
    return session;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
    if (raw) await this.logoutUseCase.execute(raw);
    // Siempre se limpia la cookie, exista o no la sesión en base de datos.
    clearRefreshCookie(res);
  }

  @Post('logout-all')
  @Auth()
  @HttpCode(204)
  async logoutAll(
    @GetUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.logoutAllUseCase.execute(user.id);
    clearRefreshCookie(res);
  }

  @Post('google')
  @HttpCode(200)
  async loginWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, refreshToken } = await this.loginWithGoogleUseCase.execute(
      {
        idToken: dto.idToken,
        dataPolicyAccepted: dto.dataPolicyAccepted,
      },
    );
    setRefreshCookie(res, refreshToken, this.sessionConfig.refreshTtlMs);
    return session;
  }

  // Antes exigía rol admin (defecto): cualquier autenticado consulta su sesión.
  @Get('check-status')
  @Auth()
  checkAuthStatus(@GetUser() user: User) {
    return this.getAuthStatus.execute(user.id);
  }

  @Patch('me/profile')
  @Auth()
  updateProfile(@GetUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.updateProfileUseCase.execute(user.id, {
      fullName: dto.fullName,
    });
  }

  @Patch('me/email')
  @Auth()
  updateEmail(@GetUser() user: User, @Body() dto: UpdateEmailDto) {
    return this.updateEmailUseCase.execute(user.id, {
      currentPassword: dto.currentPassword,
      newEmail: dto.newEmail,
    });
  }

  @Patch('me/password')
  @Auth()
  updatePassword(@GetUser() user: User, @Body() dto: UpdatePasswordDto) {
    return this.updatePasswordUseCase.execute(user.id, {
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
    });
  }

  @Post('forgot-password')
  @HttpCode(202)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.requestPasswordReset.execute(dto.email);
    // Respuesta idéntica exista o no la cuenta (regla 5).
    return {
      message:
        'Si el correo está registrado, enviaremos un enlace para restablecer la contraseña.',
    };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.performPasswordReset.execute(dto.token, dto.newPassword);
    return {
      message: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión.',
    };
  }

  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.confirmEmail.execute(dto.token);
    return { message: 'Tu correo quedó confirmado.' };
  }

  @Post('resend-verification')
  @HttpCode(202)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.resendConfirmation.execute(dto.email);
    return {
      message:
        'Si la cuenta existe y no está verificada, enviaremos un nuevo enlace.',
    };
  }
}

import 'reflect-metadata';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController (hexagonal)', () => {
  let controller: AuthController;
  let registerUser: { execute: jest.Mock };
  let loginUser: { execute: jest.Mock };
  let getAuthStatus: { execute: jest.Mock };
  let updateProfile: { execute: jest.Mock };
  let updateEmail: { execute: jest.Mock };
  let updatePassword: { execute: jest.Mock };
  let requestPasswordReset: { execute: jest.Mock };
  let performPasswordReset: { execute: jest.Mock };
  let confirmEmail: { execute: jest.Mock };
  let resendConfirmation: { execute: jest.Mock };
  let refreshSession: { execute: jest.Mock };
  let logoutUseCase: { execute: jest.Mock };
  let logoutAll: { execute: jest.Mock };
  let loginWithGoogle: { execute: jest.Mock };

  const makeRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() }) as any;

  beforeEach(() => {
    registerUser = { execute: jest.fn() };
    loginUser = { execute: jest.fn() };
    getAuthStatus = { execute: jest.fn() };
    updateProfile = { execute: jest.fn() };
    updateEmail = { execute: jest.fn() };
    updatePassword = { execute: jest.fn() };
    requestPasswordReset = { execute: jest.fn() };
    performPasswordReset = { execute: jest.fn() };
    confirmEmail = { execute: jest.fn() };
    resendConfirmation = { execute: jest.fn() };
    refreshSession = { execute: jest.fn() };
    logoutUseCase = { execute: jest.fn() };
    logoutAll = { execute: jest.fn() };
    loginWithGoogle = { execute: jest.fn() };
    controller = new AuthController(
      registerUser as any,
      loginUser as any,
      getAuthStatus as any,
      updateProfile as any,
      updateEmail as any,
      updatePassword as any,
      requestPasswordReset as any,
      performPasswordReset as any,
      confirmEmail as any,
      resendConfirmation as any,
      refreshSession as any,
      logoutUseCase as any,
      logoutAll as any,
      loginWithGoogle as any,
      { refreshTtlDays: 30, refreshTtlMs: 2592000000 } as any,
    );
  });

  it('register delega al caso de uso con el comando mapeado', async () => {
    // El caso de uso devuelve sesión + refresh; el controller solo expone la
    // sesión (el refresh viaja en cookie, T6).
    registerUser.execute.mockResolvedValue({
      session: { id: 'u-1' },
      refreshToken: 'rt',
    });
    const dto = {
      email: 'a@b.com',
      password: 'Str0ngP@ss!',
      fullName: 'A',
      dataPolicyAccepted: true,
    };
    const res = makeRes();
    await expect(controller.register(dto as any, res)).resolves.toEqual({
      id: 'u-1',
    });
    expect(registerUser.execute).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'Str0ngP@ss!',
      fullName: 'A',
      dataPolicyAccepted: true,
    });
    // El refresh viaja en cookie, no en el cuerpo.
    expect(res.cookie).toHaveBeenCalledWith(
      'marlene_rt',
      'rt',
      expect.any(Object),
    );
  });

  it('login delega al caso de uso y fija la cookie de refresh', async () => {
    loginUser.execute.mockResolvedValue({
      session: { token: 't' },
      refreshToken: 'rt',
    });
    const res = makeRes();
    await expect(
      controller.login({ email: 'a@b.com', password: 'x' } as any, res),
    ).resolves.toEqual({ token: 't' });
    expect(loginUser.execute).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'x',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'marlene_rt',
      'rt',
      expect.any(Object),
    );
  });

  it('refresh rota la sesión con la cookie y fija la nueva', async () => {
    refreshSession.execute.mockResolvedValue({
      session: { token: 'nuevo' },
      refreshToken: 'rt2',
    });
    const res = makeRes();
    const req = { cookies: { marlene_rt: 'rt1' } } as any;
    await expect(controller.refresh(req, res)).resolves.toEqual({
      token: 'nuevo',
    });
    expect(refreshSession.execute).toHaveBeenCalledWith('rt1');
    expect(res.cookie).toHaveBeenCalledWith(
      'marlene_rt',
      'rt2',
      expect.any(Object),
    );
  });

  it('refresh sin cookie responde 401 sin tocar el caso de uso', async () => {
    const req = { cookies: {} } as any;
    await expect(controller.refresh(req, makeRes())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(refreshSession.execute).not.toHaveBeenCalled();
  });

  it('logout revoca y limpia la cookie aunque no exista sesión', async () => {
    const res = makeRes();
    await controller.logout({ cookies: {} } as any, res);
    expect(logoutUseCase.execute).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith(
      'marlene_rt',
      expect.any(Object),
    );
  });

  it('logout con cookie revoca en servidor y limpia', async () => {
    const res = makeRes();
    await controller.logout({ cookies: { marlene_rt: 'rt1' } } as any, res);
    expect(logoutUseCase.execute).toHaveBeenCalledWith('rt1');
    expect(res.clearCookie).toHaveBeenCalledWith(
      'marlene_rt',
      expect.any(Object),
    );
  });

  it('google delega al caso de uso y fija la cookie', async () => {
    loginWithGoogle.execute.mockResolvedValue({
      session: { email: 'ana@gmail.com' },
      refreshToken: 'rt',
    });
    const res = makeRes();
    await expect(
      controller.loginWithGoogle(
        {
          idToken: 'id-token-largo-de-google',
          dataPolicyAccepted: true,
        } as any,
        res,
      ),
    ).resolves.toEqual({ email: 'ana@gmail.com' });
    expect(loginWithGoogle.execute).toHaveBeenCalledWith({
      idToken: 'id-token-largo-de-google',
      dataPolicyAccepted: true,
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'marlene_rt',
      'rt',
      expect.any(Object),
    );
  });

  it('check-status delega con el id del usuario autenticado', async () => {
    getAuthStatus.execute.mockResolvedValue({ id: 'u-1' });
    await controller.checkAuthStatus({ id: 'u-1' } as any);
    expect(getAuthStatus.execute).toHaveBeenCalledWith('u-1');
  });

  it('me/email delega con el id y el comando', async () => {
    updateEmail.execute.mockResolvedValue({ id: 'u-1' });
    await controller.updateEmail(
      { id: 'u-1' } as any,
      {
        currentPassword: 'c',
        newEmail: 'n@n.com',
      } as any,
    );
    expect(updateEmail.execute).toHaveBeenCalledWith('u-1', {
      currentPassword: 'c',
      newEmail: 'n@n.com',
    });
  });

  it('forgot-password responde un mensaje genérico y delega', async () => {
    requestPasswordReset.execute.mockResolvedValue(undefined);
    const res = await controller.forgotPassword({ email: 'a@b.com' } as any);
    expect(requestPasswordReset.execute).toHaveBeenCalledWith('a@b.com');
    expect(res.message).toMatch(/Si el correo está registrado/);
  });

  it('reset-password delega token y nueva contraseña', async () => {
    performPasswordReset.execute.mockResolvedValue(undefined);
    const res = await controller.resetPassword({
      token: 'tok',
      newPassword: 'New-1234!',
    } as any);
    expect(performPasswordReset.execute).toHaveBeenCalledWith(
      'tok',
      'New-1234!',
    );
    expect(res.message).toMatch(/actualizada/);
  });

  it('verify-email delega el token', async () => {
    confirmEmail.execute.mockResolvedValue(undefined);
    const res = await controller.verifyEmail({ token: 'tok' } as any);
    expect(confirmEmail.execute).toHaveBeenCalledWith('tok');
    expect(res.message).toMatch(/confirmado/);
  });

  it('resend-verification responde mensaje genérico y delega', async () => {
    resendConfirmation.execute.mockResolvedValue(undefined);
    const res = await controller.resendVerification({
      email: 'a@b.com',
    } as any);
    expect(resendConfirmation.execute).toHaveBeenCalledWith('a@b.com');
    expect(res.message).toMatch(/Si la cuenta existe/);
  });

  it('check-status ya NO exige rol admin (defecto corregido)', () => {
    const roles = Reflect.getMetadata(
      'roles',
      AuthController.prototype.checkAuthStatus,
    );
    expect(roles ?? []).not.toContain('admin');
  });
});

import 'reflect-metadata';
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
    await expect(controller.register(dto as any)).resolves.toEqual({
      id: 'u-1',
    });
    expect(registerUser.execute).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'Str0ngP@ss!',
      fullName: 'A',
      dataPolicyAccepted: true,
    });
  });

  it('login delega al caso de uso', async () => {
    loginUser.execute.mockResolvedValue({
      session: { token: 't' },
      refreshToken: 'rt',
    });
    await expect(
      controller.login({ email: 'a@b.com', password: 'x' } as any),
    ).resolves.toEqual({ token: 't' });
    expect(loginUser.execute).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'x',
    });
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

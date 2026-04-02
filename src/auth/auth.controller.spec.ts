import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'create' | 'login' | 'checkAuthStatus'>
  >;

  beforeEach(() => {
    authService = {
      create: jest.fn(),
      login: jest.fn(),
      checkAuthStatus: jest.fn(),
    };
    controller = new AuthController(authService as any);
  });

  it('register delegates to service.create', async () => {
    authService.create.mockResolvedValue({ ok: true } as any);
    const dto = { email: 'a@b.com', password: 'Str0ngP@ssw0rd!', fullName: 'A' };

    await expect(controller.createUser(dto as any)).resolves.toEqual({ ok: true });
    expect(authService.create).toHaveBeenCalledWith(dto);
  });

  it('login delegates to service.login', async () => {
    authService.login.mockResolvedValue({ token: 't' } as any);
    const dto = { email: 'a@b.com', password: 'Str0ngP@ssw0rd!' };

    await expect(controller.loginUser(dto as any)).resolves.toEqual({ token: 't' });
    expect(authService.login).toHaveBeenCalledWith(dto);
  });

  it('check-status delegates to service.checkAuthStatus', () => {
    authService.checkAuthStatus.mockReturnValue({ token: 't' } as any);
    const user = { id: '1' } as any;

    expect(controller.checkAuthStatus(user)).toEqual({ token: 't' });
    expect(authService.checkAuthStatus).toHaveBeenCalledWith(user);
  });
});

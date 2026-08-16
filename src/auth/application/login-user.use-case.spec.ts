import { LoginUserUseCase } from './login-user.use-case';
import { InvalidCredentialsError, InactiveUserError } from '../domain/errors';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';

function account(overrides: any = {}) {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('a@b.com'),
    passwordHash: 'stored',
    fullName: 'Ana',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: null,
    dataPolicyAcceptedAt: null,
    ...overrides,
  });
}

function build({
  found = account() as UserAccount | null,
  compare = async () => true,
}: { found?: UserAccount | null; compare?: () => Promise<boolean> } = {}) {
  return new LoginUserUseCase(
    { findByEmail: async () => found } as any,
    { hash: async () => 'x', compare } as any,
    { issueAccessToken: () => 'jwt' } as any,
  );
}

describe('LoginUserUseCase', () => {
  it('devuelve sesión con credenciales válidas', async () => {
    const s = await build().execute({ email: 'A@B.com', password: 'secret' });
    expect(s.id).toBe('u-1');
    expect(s.token).toBe('jwt');
    expect(s.emailVerified).toBe(false);
  });

  it('rechaza con el mismo error cuando el correo no existe', async () => {
    await expect(
      build({ found: null }).execute({ email: 'a@b.com', password: 'x' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rechaza con el mismo error cuando la contraseña no coincide', async () => {
    await expect(
      build({ compare: async () => false }).execute({
        email: 'a@b.com',
        password: 'x',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rechaza cuentas inactivas', async () => {
    await expect(
      build({ found: account({ isActive: false }) }).execute({
        email: 'a@b.com',
        password: 'x',
      }),
    ).rejects.toThrow(InactiveUserError);
  });
});

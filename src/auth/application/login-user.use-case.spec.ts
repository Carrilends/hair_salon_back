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

const issuer = {
  issueAccessToken: () => 'jwt',
  accessTokenTtlSeconds: () => 900,
  issueRefreshToken: () => ({
    raw: 'raw-rt',
    hash: 'hash-rt',
    familyId: 'fam',
  }),
  hashRefreshToken: (r: string) => `h-${r}`,
};

function build({
  found = account() as UserAccount | null,
  compare = async () => true,
}: { found?: UserAccount | null; compare?: () => Promise<boolean> } = {}) {
  const savedRefresh: any[] = [];
  const uc = new LoginUserUseCase(
    { findByEmail: async () => found } as any,
    { hash: async () => 'x', compare } as any,
    issuer as any,
    { save: async (t: any) => savedRefresh.push(t) } as any,
    { now: () => new Date('2026-08-04T10:00:00.000Z') } as any,
    { refreshTtlDays: 30, refreshTtlMs: 30 * 24 * 60 * 60 * 1000 } as any,
  );
  return Object.assign(uc, { savedRefresh });
}

describe('LoginUserUseCase', () => {
  it('devuelve sesión y refresh con credenciales válidas', async () => {
    const r = await build().execute({ email: 'A@B.com', password: 'secret' });
    expect(r.session.id).toBe('u-1');
    expect(r.session.token).toBe('jwt');
    expect(r.session.expiresIn).toBe(900);
    expect(r.session.emailVerified).toBe(false);
    expect(r.refreshToken).toBe('raw-rt');
  });

  it('rechaza una cuenta de Google sin contraseña local con el mismo error (S8)', async () => {
    await expect(
      build({ found: account({ passwordHash: null }) }).execute({
        email: 'a@b.com',
        password: 'x',
      }),
    ).rejects.toThrow(InvalidCredentialsError);
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

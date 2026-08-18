import { RegisterUserUseCase } from './register-user.use-case';
import { EmailAlreadyInUseError } from '../domain/errors';
import { UserAccount } from '../domain/user-account';

const now = new Date('2026-08-04T10:00:00.000Z');

function deps(overrides: any = {}) {
  const saved: UserAccount[] = [];
  const sent: any[] = [];
  const issuedTokens: any[] = [];
  const invalidated: any[] = [];
  return {
    saved,
    sent,
    issuedTokens,
    invalidated,
    users: {
      existsByEmail: async () => false,
      save: async (u: UserAccount) => {
        saved.push(u);
        return UserAccount.fromPersistence({
          id: 'u-1',
          email: u.email,
          passwordHash: u.passwordHash,
          fullName: u.fullName,
          roles: u.roles,
          isActive: u.isActive,
          emailVerifiedAt: u.emailVerifiedAt,
          dataPolicyAcceptedAt: u.dataPolicyAcceptedAt,
        });
      },
      ...overrides.users,
    },
    authTokens: {
      save: async (t: any) => {
        issuedTokens.push(t);
        return t;
      },
      invalidateAllOfType: async (userId: string, type: string, at: Date) => {
        invalidated.push({ userId, type, at });
      },
      findByHash: async () => null,
    },
    hasher: { hash: async () => 'hashed', compare: async () => true },
    issuer: {
      issueAccessToken: () => 'jwt-token',
      accessTokenTtlSeconds: () => 900,
      issueRefreshToken: () => ({
        raw: 'raw-rt',
        hash: 'hash-rt',
        familyId: 'fam',
      }),
      hashRefreshToken: (r: string) => `h-${r}`,
    },
    refreshTokens: { save: async (t: any) => t },
    generator: {
      generate: () => ({ raw: 'raw-token', hash: 'hash-token' }),
      hash: () => 'hash-token',
    },
    mailer: {
      send: async (m: any) => {
        sent.push(m);
      },
    },
    clock: { now: () => now },
  };
}

function build(d: any) {
  return new RegisterUserUseCase(
    d.users,
    d.authTokens,
    d.hasher,
    d.issuer,
    d.generator,
    d.mailer,
    d.clock,
    {
      verifyEmailUrl: 'https://front/auth/verificar-correo',
      resetPasswordUrl: 'https://front/auth/restablecer',
    } as any,
    d.refreshTokens,
    { refreshTtlDays: 30, refreshTtlMs: 30 * 24 * 60 * 60 * 1000 },
  );
}

describe('RegisterUserUseCase', () => {
  it('crea la cuenta, devuelve sesión y envía la verificación', async () => {
    const d = deps();
    const result = await build(d).execute({
      email: 'Nueva@Correo.com',
      password: 'Sup3rS3gura!',
      fullName: 'Nueva',
      dataPolicyAccepted: true,
    });
    expect(result.session.id).toBe('u-1');
    expect(result.session.emailVerified).toBe(false);
    expect(result.session.token).toBe('jwt-token');
    expect(result.refreshToken).toBe('raw-rt');
    expect(d.saved[0].passwordHash).toBe('hashed');
    expect(d.saved[0].email.value).toBe('nueva@correo.com');
    expect(d.issuedTokens).toHaveLength(1);
    expect(d.sent[0].to).toBe('nueva@correo.com');
    expect(d.sent[0].text).toContain('raw-token');
  });

  it('invalida cualquier verificación previa antes de emitir la nueva (M3)', async () => {
    const d = deps();
    await build(d).execute({
      email: 'nueva@correo.com',
      password: 'Sup3rS3gura!',
      fullName: 'Nueva',
      dataPolicyAccepted: true,
    });
    expect(d.invalidated).toEqual([
      { userId: 'u-1', type: 'email_verification', at: now },
    ]);
  });

  it('rechaza correos ya registrados', async () => {
    const d = deps({ users: { existsByEmail: async () => true } });
    await expect(
      build(d).execute({
        email: 'a@b.com',
        password: 'Sup3rS3gura!',
        fullName: 'A',
        dataPolicyAccepted: true,
      }),
    ).rejects.toThrow(EmailAlreadyInUseError);
  });

  it('el fallo del correo NO revierte el registro', async () => {
    const d = deps();
    d.mailer.send = async () => {
      throw new Error('proveedor caído');
    };
    const result = await build(d).execute({
      email: 'a@b.com',
      password: 'Sup3rS3gura!',
      fullName: 'A',
      dataPolicyAccepted: true,
    });
    expect(result.session.id).toBe('u-1');
  });
});

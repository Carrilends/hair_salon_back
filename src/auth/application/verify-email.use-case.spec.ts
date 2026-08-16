import { VerifyEmailUseCase } from './verify-email.use-case';
import { AuthToken } from '../domain/auth-token';
import { AuthTokenType } from '../domain/auth-token-type';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';
import {
  AuthTokenNotFoundError,
  ExpiredAuthTokenError,
} from '../domain/errors';

const now = new Date('2026-08-04T10:00:00.000Z');

function account(overrides: any = {}) {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('a@b.com'),
    passwordHash: 'h',
    fullName: 'Ana',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: null,
    dataPolicyAcceptedAt: null,
    ...overrides,
  });
}

function token(
  overrides: { usedAt?: Date | null; expiresAt?: Date } = {},
): AuthToken {
  return AuthToken.fromPersistence({
    id: 't-1',
    userId: 'u-1',
    type: AuthTokenType.EmailVerification,
    tokenHash: 'hash-1',
    expiresAt: overrides.expiresAt ?? new Date(now.getTime() + 60 * 60 * 1000),
    usedAt: overrides.usedAt ?? null,
  });
}

function deps({
  found = token() as AuthToken | null,
  user = account(),
}: { found?: AuthToken | null; user?: UserAccount } = {}) {
  const savedUsers: any[] = [];
  const savedTokens: any[] = [];
  return {
    savedUsers,
    savedTokens,
    uc: new VerifyEmailUseCase(
      {
        findById: async () => user,
        save: async (u: any) => {
          savedUsers.push(u);
          return u;
        },
      } as any,
      {
        findByHash: async () => found,
        save: async (t: any) => {
          savedTokens.push(t);
          return t;
        },
        invalidateAllOfType: async () => undefined,
      } as any,
      { generate: () => ({ raw: 'r', hash: 'h' }), hash: () => 'hash-1' } as any,
      { now: () => now } as any,
    ),
  };
}

describe('VerifyEmailUseCase', () => {
  it('marca la cuenta como verificada y consume el token', async () => {
    const d = deps();
    await d.uc.execute('raw');
    expect(d.savedUsers[0].isEmailVerified).toBe(true);
    expect(d.savedTokens[0].usedAt).toEqual(now);
  });

  it('rechaza un token inexistente', async () => {
    await expect(deps({ found: null }).uc.execute('x')).rejects.toThrow(
      AuthTokenNotFoundError,
    );
  });

  it('rechaza un token expirado si la cuenta no está verificada', async () => {
    const d = deps({
      found: token({ expiresAt: new Date(now.getTime() - 1000) }),
    });
    await expect(d.uc.execute('raw')).rejects.toThrow(ExpiredAuthTokenError);
  });

  it('es idempotente ante un doble clic: token ya usado + cuenta ya verificada → éxito', async () => {
    const d = deps({
      found: token({ usedAt: now }),
      user: account({ emailVerifiedAt: now }),
    });
    await expect(d.uc.execute('raw')).resolves.toBeUndefined();
    // No re-guarda al usuario ni re-consume el token: solo confirma el éxito.
    expect(d.savedUsers).toHaveLength(0);
  });
});

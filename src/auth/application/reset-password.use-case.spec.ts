import { ResetPasswordUseCase } from './reset-password.use-case';
import { AuthToken } from '../domain/auth-token';
import { AuthTokenType } from '../domain/auth-token-type';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';
import {
  AuthTokenNotFoundError,
  ExpiredAuthTokenError,
  AuthTokenAlreadyUsedError,
} from '../domain/errors';

const now = new Date('2026-08-04T10:00:00.000Z');

function account() {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('a@b.com'),
    passwordHash: 'old-hash',
    fullName: 'Ana',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: null,
    dataPolicyAcceptedAt: null,
  });
}

function token(
  overrides: { usedAt?: Date | null; expiresAt?: Date } = {},
): AuthToken {
  return AuthToken.fromPersistence({
    id: 't-1',
    userId: 'u-1',
    type: AuthTokenType.PasswordReset,
    tokenHash: 'hash-1',
    expiresAt: overrides.expiresAt ?? new Date(now.getTime() + 30 * 60 * 1000),
    usedAt: overrides.usedAt ?? null,
  });
}

function deps({ found = token() as AuthToken | null } = {}) {
  const savedUsers: any[] = [];
  const savedTokens: any[] = [];
  const invalidated: any[] = [];
  return {
    savedUsers,
    savedTokens,
    invalidated,
    uc: new ResetPasswordUseCase(
      {
        findById: async () => account(),
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
        invalidateAllOfType: async (id: string, type: string) => {
          invalidated.push({ id, type });
        },
      } as any,
      { hash: async () => 'new-hash', compare: async () => true } as any,
      { generate: () => ({ raw: 'r', hash: 'h' }), hash: () => 'hash-1' } as any,
      { now: () => now } as any,
    ),
  };
}

describe('ResetPasswordUseCase', () => {
  it('cambia la contraseña, marca el token usado e invalida los hermanos', async () => {
    const d = deps();
    await d.uc.execute('raw-token', 'New-1234!');
    expect(d.savedUsers[0].passwordHash).toBe('new-hash');
    expect(d.savedTokens[0].usedAt).toEqual(now);
    expect(d.invalidated[0]).toEqual({ id: 'u-1', type: 'password_reset' });
  });

  it('rechaza un token inexistente', async () => {
    await expect(
      deps({ found: null }).uc.execute('x', 'New-1234!'),
    ).rejects.toThrow(AuthTokenNotFoundError);
  });

  it('rechaza un token expirado', async () => {
    const d = deps({ found: token({ expiresAt: new Date(now.getTime() - 1000) }) });
    await expect(d.uc.execute('x', 'New-1234!')).rejects.toThrow(
      ExpiredAuthTokenError,
    );
  });

  it('rechaza un token ya usado', async () => {
    const d = deps({ found: token({ usedAt: now }) });
    await expect(d.uc.execute('x', 'New-1234!')).rejects.toThrow(
      AuthTokenAlreadyUsedError,
    );
  });
});

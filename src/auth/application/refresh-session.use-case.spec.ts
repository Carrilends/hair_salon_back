import { RefreshSessionUseCase } from './refresh-session.use-case';
import { RefreshToken } from '../domain/refresh-token';
import {
  RefreshTokenReuseDetectedError,
  InvalidRefreshTokenError,
} from '../domain/errors';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';

const now = new Date('2026-08-04T10:00:00.000Z');

const user = UserAccount.fromPersistence({
  id: 'u-1',
  email: Email.create('a@b.com'),
  passwordHash: 'h',
  fullName: 'Ana',
  roles: ['user'],
  isActive: true,
  emailVerifiedAt: now,
  dataPolicyAcceptedAt: now,
});

function build(stored: RefreshToken | null) {
  const revokedFamilies: string[] = [];
  const repo = {
    findByHash: async () => stored,
    saveRotation: async (_c: RefreshToken, issued: RefreshToken) => issued,
    revokeFamily: async (familyId: string) => {
      revokedFamilies.push(familyId);
      return 2;
    },
    revokeAllOfUser: async () => 0,
    save: async (t: RefreshToken) => t,
  };
  const uc = new RefreshSessionUseCase(
    repo as any,
    { findById: async () => user } as any,
    {
      issueAccessToken: () => 'access-nuevo',
      accessTokenTtlSeconds: () => 900,
      issueRefreshToken: () => ({
        raw: 'raw-2',
        hash: 'hash-2',
        familyId: 'fam-nueva',
      }),
      hashRefreshToken: () => 'hash-1',
    } as any,
    { now: () => now } as any,
  );
  return { uc, revokedFamilies };
}

describe('RefreshSessionUseCase', () => {
  it('rota y devuelve sesión nueva', async () => {
    const stored = RefreshToken.issue({
      userId: 'u-1',
      tokenHash: 'hash-1',
      now,
      ttlDays: 30,
    });
    const { uc } = build(stored);
    const result = await uc.execute('raw-1');
    expect(result.session.token).toBe('access-nuevo');
    expect(result.session.expiresIn).toBe(900);
    expect(result.refreshToken).toBe('raw-2');
  });

  it('ante un token desconocido no revela nada', async () => {
    const { uc } = build(null);
    await expect(uc.execute('raw-desconocido')).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it('ante reuso revoca la familia completa', async () => {
    const stored = RefreshToken.issue({
      userId: 'u-1',
      tokenHash: 'hash-1',
      now,
      ttlDays: 30,
    });
    stored.rotate({ tokenHash: 'hash-intermedio', now });
    const { uc, revokedFamilies } = build(stored);
    await expect(uc.execute('raw-1')).rejects.toThrow(
      RefreshTokenReuseDetectedError,
    );
    expect(revokedFamilies).toEqual([stored.familyId]);
  });
});

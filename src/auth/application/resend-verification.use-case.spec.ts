import { ResendVerificationUseCase } from './resend-verification.use-case';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';

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

function deps(user: UserAccount | null) {
  const sent: any[] = [];
  const issued: any[] = [];
  const invalidated: any[] = [];
  return {
    sent,
    issued,
    invalidated,
    uc: new ResendVerificationUseCase(
      { findByEmail: async () => user } as any,
      {
        save: async (t: any) => {
          issued.push(t);
          return t;
        },
        invalidateAllOfType: async (userId: string, type: string, at: Date) => {
          invalidated.push({ userId, type, at });
        },
        findByHash: async () => null,
      } as any,
      {
        generate: () => ({ raw: 'raw', hash: 'hash' }),
        hash: () => 'hash',
      } as any,
      {
        send: async (m: any) => {
          sent.push(m);
        },
      } as any,
      { now: () => now } as any,
      {
        resetPasswordUrl: 'https://f/r',
        verifyEmailUrl: 'https://f/v',
      } as any,
    ),
  };
}

describe('ResendVerificationUseCase', () => {
  it('reenvía la verificación a una cuenta sin verificar', async () => {
    const d = deps(account());
    await d.uc.execute('A@B.com');
    expect(d.issued).toHaveLength(1);
    expect(d.sent[0].to).toBe('a@b.com');
  });

  it('invalida las verificaciones previas antes de emitir una nueva (M3)', async () => {
    const d = deps(account());
    await d.uc.execute('a@b.com');
    expect(d.invalidated).toEqual([
      { userId: 'u-1', type: 'email_verification', at: now },
    ]);
  });

  it('no revela nada si la cuenta no existe', async () => {
    const d = deps(null);
    await expect(d.uc.execute('x@y.com')).resolves.toBeUndefined();
    expect(d.sent).toHaveLength(0);
  });

  it('no hace nada si la cuenta ya está verificada', async () => {
    const d = deps(account({ emailVerifiedAt: now }));
    await d.uc.execute('a@b.com');
    expect(d.sent).toHaveLength(0);
  });
});

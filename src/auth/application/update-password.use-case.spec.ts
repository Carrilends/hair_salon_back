import { UpdatePasswordUseCase } from './update-password.use-case';
import { InvalidCredentialsError, SamePasswordError } from '../domain/errors';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';

function account() {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('a@b.com'),
    passwordHash: 'stored',
    fullName: 'Ana',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: null,
    dataPolicyAcceptedAt: null,
  });
}

function deps({
  compare = async () => true,
}: { compare?: () => Promise<boolean> } = {}) {
  const saved: any[] = [];
  return {
    saved,
    uc: new UpdatePasswordUseCase(
      {
        findById: async () => account(),
        save: async (u: any) => {
          saved.push(u);
          return u;
        },
      } as any,
      { hash: async () => 'new-hash', compare } as any,
      {
        issueAccessToken: () => 'jwt',
        accessTokenTtlSeconds: () => 900,
      } as any,
    ),
  };
}

describe('UpdatePasswordUseCase', () => {
  it('cambia la contraseña cuando la actual es correcta y distinta', async () => {
    const d = deps();
    const s = await d.uc.execute('u-1', {
      currentPassword: 'old',
      newPassword: 'New-1234!',
    });
    expect(s.id).toBe('u-1');
    expect(d.saved[0].passwordHash).toBe('new-hash');
  });

  it('rechaza si la contraseña actual no coincide', async () => {
    const d = deps({ compare: async () => false });
    await expect(
      d.uc.execute('u-1', { currentPassword: 'x', newPassword: 'New-1234!' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rechaza repetir la misma contraseña', async () => {
    const d = deps();
    await expect(
      d.uc.execute('u-1', { currentPassword: 'same', newPassword: 'same' }),
    ).rejects.toThrow(SamePasswordError);
  });
});

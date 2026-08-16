import { UpdateProfileUseCase } from './update-profile.use-case';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';

function account() {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('a@b.com'),
    passwordHash: 'h',
    fullName: 'Ana',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: null,
    dataPolicyAcceptedAt: null,
  });
}

describe('UpdateProfileUseCase', () => {
  it('renombra la cuenta y propaga el nombre a las reseñas', async () => {
    const renamed: any[] = [];
    const saved: any[] = [];
    const uc = new UpdateProfileUseCase(
      {
        findById: async () => account(),
        save: async (u: any) => {
          saved.push(u);
          return u;
        },
      } as any,
      {
        rename: async (id: string, name: string) => {
          renamed.push({ id, name });
        },
      } as any,
      { issueAccessToken: () => 'jwt' } as any,
    );
    const s = await uc.execute('u-1', { fullName: '  Ana María  ' });
    expect(s.fullName).toBe('Ana María');
    expect(saved[0].fullName).toBe('Ana María');
    expect(renamed[0]).toEqual({ id: 'u-1', name: 'Ana María' });
  });
});

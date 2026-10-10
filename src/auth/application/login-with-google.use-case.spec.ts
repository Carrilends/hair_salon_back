import { LoginWithGoogleUseCase } from './login-with-google.use-case';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';
import {
  GoogleAccountNotVerifiedError,
  DataPolicyConsentRequiredError,
} from '../domain/errors';

const now = new Date('2026-08-04T10:00:00.000Z');

const GOOGLE_PROFILE = {
  googleId: 'g-123',
  email: 'ana@gmail.com',
  emailVerified: true,
  fullName: 'Ana Gómez',
};

function localAccount(overrides: any = {}) {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('ana@gmail.com'),
    passwordHash: 'hash',
    fullName: 'Ana',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: null,
    dataPolicyAcceptedAt: now,
    googleId: null,
    ...overrides,
  });
}

function build({
  profile = GOOGLE_PROFILE,
  byGoogleId = null as UserAccount | null,
  byEmail = null as UserAccount | null,
}: any = {}) {
  const saved: UserAccount[] = [];
  const uc = new LoginWithGoogleUseCase(
    { verifyIdToken: async () => profile } as any,
    {
      findByGoogleId: async () => byGoogleId,
      findByEmail: async () => byEmail,
      save: async (u: UserAccount) => {
        saved.push(u);
        return u;
      },
    } as any,
    {
      issueAccessToken: () => 'access',
      accessTokenTtlSeconds: () => 900,
      issueRefreshToken: () => ({
        raw: 'raw-rt',
        hash: 'hash-rt',
        familyId: 'fam',
      }),
      hashRefreshToken: (r: string) => `h-${r}`,
    } as any,
    { save: async (t: any) => t } as any,
    { now: () => now } as any,
    { refreshTtlDays: 30, refreshTtlMs: 30 * 24 * 60 * 60 * 1000 } as any,
  );
  return { uc, saved };
}

describe('LoginWithGoogleUseCase', () => {
  it('rechaza un correo de Google sin verificar', async () => {
    const { uc } = build({
      profile: { ...GOOGLE_PROFILE, emailVerified: false },
    });
    await expect(uc.execute({ idToken: 'x' })).rejects.toThrow(
      GoogleAccountNotVerifiedError,
    );
  });

  it('exige consentimiento al crear una cuenta nueva (S9)', async () => {
    const { uc } = build();
    await expect(uc.execute({ idToken: 'x' })).rejects.toThrow(
      DataPolicyConsentRequiredError,
    );
  });

  it('crea la cuenta nueva cuando hay consentimiento y devuelve sesión + refresh', async () => {
    const { uc, saved } = build();
    const result = await uc.execute({ idToken: 'x', dataPolicyAccepted: true });
    expect(saved).toHaveLength(1);
    expect(saved[0].googleId).toBe('g-123');
    expect(saved[0].passwordHash).toBeNull(); // sin contraseña local (S8)
    expect(saved[0].isEmailVerified).toBe(true); // Google ya lo verificó
    expect(result.session.email).toBe('ana@gmail.com');
    expect(result.refreshToken).toBe('raw-rt');
  });

  it('vincula con la cuenta local existente del mismo correo, sin duplicar (RF52)', async () => {
    const existing = localAccount();
    const { uc, saved } = build({ byGoogleId: null, byEmail: existing });
    await uc.execute({ idToken: 'x' });
    expect(saved).toHaveLength(1);
    expect(saved[0].googleId).toBe('g-123');
    expect(saved[0].id).toBe('u-1'); // la misma cuenta, no una nueva
    expect(saved[0].isEmailVerified).toBe(true); // vincular verifica el correo
  });

  it('en el segundo inicio encuentra por googleId y no vuelve a vincular', async () => {
    const linked = localAccount({ googleId: 'g-123', emailVerifiedAt: now });
    const { uc, saved } = build({ byGoogleId: linked });
    const result = await uc.execute({ idToken: 'x' });
    expect(saved).toHaveLength(0); // no persiste vinculación de nuevo
    expect(result.refreshToken).toBe('raw-rt');
  });

  it('la sesión de una cuenta nueva de Google dice que no tiene contraseña (plan 6, C3)', async () => {
    const { uc } = build();
    const result = await uc.execute({ idToken: 'x', dataPolicyAccepted: true });
    expect(result.session.hasPassword).toBe(false);
  });

  it('vincular Google a una cuenta local conserva su contraseña en la sesión', async () => {
    const { uc } = build({ byEmail: localAccount() });
    const result = await uc.execute({ idToken: 'x' });
    expect(result.session.hasPassword).toBe(true);
  });
});

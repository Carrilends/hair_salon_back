import { UpdateEmailUseCase } from './update-email.use-case';
import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  SameEmailError,
} from '../domain/errors';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';

const now = new Date('2026-08-04T10:00:00.000Z');

function account(overrides: any = {}) {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('a@b.com'),
    passwordHash: 'stored',
    fullName: 'Ana',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: now,
    dataPolicyAcceptedAt: null,
    ...overrides,
  });
}

function deps({
  compare = async () => true,
  emailTaken = false,
}: {
  compare?: () => Promise<boolean>;
  emailTaken?: boolean;
} = {}) {
  const saved: any[] = [];
  const sent: any[] = [];
  const issued: any[] = [];
  const invalidated: any[] = [];
  return {
    saved,
    sent,
    issued,
    invalidated,
    uc: new UpdateEmailUseCase(
      {
        findById: async () => account(),
        existsByEmail: async () => emailTaken,
        save: async (u: any) => {
          saved.push(u);
          return u;
        },
      } as any,
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
      { hash: async () => 'x', compare } as any,
      { issueAccessToken: () => 'jwt' } as any,
      { generate: () => ({ raw: 'raw', hash: 'hash' }), hash: () => 'hash' } as any,
      {
        send: async (m: any) => {
          sent.push(m);
        },
      } as any,
      { now: () => now } as any,
      { resetPasswordUrl: 'https://f/r', verifyEmailUrl: 'https://f/v' } as any,
    ),
  };
}

describe('UpdateEmailUseCase', () => {
  it('cambia el correo, lo deja sin verificar (E5) y emite una verificación nueva', async () => {
    const d = deps();
    const s = await d.uc.execute('u-1', {
      currentPassword: 'secret',
      newEmail: 'Nuevo@Correo.com',
    });
    expect(s.email).toBe('nuevo@correo.com');
    expect(s.emailVerified).toBe(false);
    expect(d.issued).toHaveLength(1);
    expect(d.sent[0].to).toBe('nuevo@correo.com');
  });

  it('invalida los enlaces de verificación viejos antes de emitir el nuevo (M3)', async () => {
    // Sin esto, el enlace enviado al correo ANTERIOR seguiría vivo 24 h y, como
    // el token solo lleva userId, verificaría la cuenta con el correo NUEVO.
    const d = deps();
    await d.uc.execute('u-1', {
      currentPassword: 'secret',
      newEmail: 'nuevo@correo.com',
    });
    expect(d.invalidated).toEqual([
      { userId: 'u-1', type: 'email_verification', at: now },
    ]);
  });

  it('rechaza si la contraseña actual no coincide', async () => {
    const d = deps({ compare: async () => false });
    await expect(
      d.uc.execute('u-1', { currentPassword: 'x', newEmail: 'z@z.com' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('rechaza cambiar al mismo correo', async () => {
    const d = deps();
    await expect(
      d.uc.execute('u-1', { currentPassword: 'secret', newEmail: 'A@B.com' }),
    ).rejects.toThrow(SameEmailError);
  });

  it('rechaza si el nuevo correo ya pertenece a otra cuenta', async () => {
    const d = deps({ emailTaken: true });
    await expect(
      d.uc.execute('u-1', {
        currentPassword: 'secret',
        newEmail: 'tomado@correo.com',
      }),
    ).rejects.toThrow(EmailAlreadyInUseError);
    expect(d.saved).toHaveLength(0);
  });
});

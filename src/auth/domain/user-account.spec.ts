import { UserAccount } from './user-account';
import { Email } from './email';
import {
  SameEmailError,
  EmailAlreadyVerifiedError,
  InactiveUserError,
} from './errors';

const now = new Date('2026-08-04T10:00:00.000Z');

function account(
  overrides: Partial<Parameters<typeof UserAccount.fromPersistence>[0]> = {},
) {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('marlene@correo.com'),
    passwordHash: 'hash',
    fullName: 'Marlene',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: null,
    dataPolicyAcceptedAt: now,
    ...overrides,
  });
}

describe('UserAccount', () => {
  it('se registra sin verificar', () => {
    const user = UserAccount.register({
      email: Email.create('nueva@correo.com'),
      passwordHash: 'hash',
      fullName: 'Nueva',
      dataPolicyAccepted: true,
      now,
    });
    expect(user.isEmailVerified).toBe(false);
    expect(user.roles).toEqual(['user']);
    expect(user.dataPolicyAcceptedAt).toEqual(now);
  });

  it('verifica el correo una sola vez', () => {
    const user = account();
    user.verifyEmail(now);
    expect(user.isEmailVerified).toBe(true);
    expect(() => user.verifyEmail(now)).toThrow(EmailAlreadyVerifiedError);
  });

  it('cambiar el correo deja la cuenta sin verificar (E5)', () => {
    const user = account({ emailVerifiedAt: now });
    user.changeEmail(Email.create('otro@correo.com'));
    expect(user.email.value).toBe('otro@correo.com');
    expect(user.isEmailVerified).toBe(false);
  });

  it('rechaza cambiar al mismo correo', () => {
    const user = account();
    expect(() => user.changeEmail(Email.create('MARLENE@correo.com'))).toThrow(
      SameEmailError,
    );
  });

  it('una cuenta inactiva no puede autenticarse', () => {
    const user = account({ isActive: false });
    expect(() => user.assertCanAuthenticate()).toThrow(InactiveUserError);
  });
});

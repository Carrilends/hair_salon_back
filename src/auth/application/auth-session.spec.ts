import { buildAuthSession } from './auth-session';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';

/**
 * `buildAuthSession` es el único sitio que arma la respuesta de sesión: la usan
 * el registro, el login, la renovación, Google, `check-status` y los tres
 * `PATCH /auth/me/*`. Mi cuenta (plan 6, C3) necesita saber si la cuenta tiene
 * contraseña local para enseñar «Entras con Google» en vez del formulario.
 */
const now = new Date('2026-10-09T15:00:00.000Z');
const issuer = {
  issueAccessToken: () => 'jwt',
  accessTokenTtlSeconds: () => 900,
} as any;

function cuenta(passwordHash: string | null, googleId: string | null = null) {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('ana@correo.com'),
    passwordHash,
    fullName: 'Ana',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: now,
    dataPolicyAcceptedAt: now,
    googleId,
  });
}

describe('buildAuthSession · hasPassword', () => {
  it('una cuenta con contraseña local lo declara', () => {
    expect(buildAuthSession(cuenta('hash'), issuer).hasPassword).toBe(true);
  });

  it('una cuenta creada con Google, sin contraseña, no', () => {
    expect(buildAuthSession(cuenta(null, 'g-1'), issuer).hasPassword).toBe(
      false,
    );
  });

  it('una cuenta local vinculada a Google conserva su contraseña', () => {
    expect(buildAuthSession(cuenta('hash', 'g-1'), issuer).hasPassword).toBe(
      true,
    );
  });

  it('un hash vacío cuenta como sin contraseña', () => {
    expect(buildAuthSession(cuenta(''), issuer).hasPassword).toBe(false);
  });

  it('la sesión conserva el resto de sus campos', () => {
    expect(buildAuthSession(cuenta('hash'), issuer)).toEqual({
      id: 'u-1',
      email: 'ana@correo.com',
      fullName: 'Ana',
      roles: ['user'],
      isActive: true,
      emailVerified: true,
      hasPassword: true,
      token: 'jwt',
      expiresIn: 900,
    });
  });
});

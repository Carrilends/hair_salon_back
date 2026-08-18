import { RefreshToken } from './refresh-token';
import { InvalidRefreshTokenError, RefreshTokenReuseDetectedError } from './errors';

const now = new Date('2026-08-04T10:00:00.000Z');

function issue() {
  return RefreshToken.issue({ userId: 'u-1', tokenHash: 'hash-1', now, ttlDays: 30 });
}

describe('RefreshToken', () => {
  it('nace vigente, con familia propia y expiración a 30 días', () => {
    const token = issue();
    expect(token.revokedAt).toBeNull();
    expect(token.familyId).toBeTruthy();
    expect(token.expiresAt.getTime() - now.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(() => token.assertUsable(now)).not.toThrow();
  });

  it('al rotar, revoca el anterior y conserva familia y expiración', () => {
    const first = issue();
    const later = new Date('2026-08-10T10:00:00.000Z');
    const second = first.rotate({ tokenHash: 'hash-2', now: later });

    expect(second.familyId).toBe(first.familyId);
    expect(second.expiresAt).toEqual(first.expiresAt); // rotar no alarga la sesión
    expect(first.revokedAt).toEqual(later);
    expect(first.replacedByHash).toBe('hash-2');
  });

  it('reutilizar un token ya rotado se distingue de un token simplemente expirado', () => {
    const first = issue();
    first.rotate({ tokenHash: 'hash-2', now });
    expect(() => first.assertUsable(now)).toThrow(RefreshTokenReuseDetectedError);

    const other = issue();
    const tooLate = new Date('2026-09-10T10:00:00.000Z');
    expect(() => other.assertUsable(tooLate)).toThrow(InvalidRefreshTokenError);
  });

  it('un token revocado por cierre de sesión no se considera reuso', () => {
    const token = issue();
    token.revoke(now);
    expect(() => token.assertUsable(now)).toThrow(InvalidRefreshTokenError);
  });
});

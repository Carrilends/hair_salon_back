import { AuthToken } from './auth-token';
import { AuthTokenType } from './auth-token-type';
import { ExpiredAuthTokenError, AuthTokenAlreadyUsedError } from './errors';

const now = new Date('2026-08-04T10:00:00.000Z');

function issue() {
  return AuthToken.issue({
    userId: 'u-1',
    type: AuthTokenType.PasswordReset,
    tokenHash: 'hash-1',
    now,
    ttlMinutes: 30,
  });
}

describe('AuthToken', () => {
  it('nace vigente y con la expiración calculada', () => {
    const token = issue();
    expect(token.usedAt).toBeNull();
    expect(token.expiresAt.getTime() - now.getTime()).toBe(30 * 60 * 1000);
    expect(() => token.assertUsable(now)).not.toThrow();
  });

  it('rechaza el uso una vez expirado', () => {
    const token = issue();
    const late = new Date('2026-08-04T10:31:00.000Z');
    expect(() => token.assertUsable(late)).toThrow(ExpiredAuthTokenError);
  });

  it('rechaza el segundo uso', () => {
    const token = issue();
    token.markUsed(now);
    expect(token.usedAt).toEqual(now);
    expect(() => token.assertUsable(now)).toThrow(AuthTokenAlreadyUsedError);
  });
});

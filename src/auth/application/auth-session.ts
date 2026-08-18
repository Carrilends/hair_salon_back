import { UserAccount } from '../domain/user-account';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';
import { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import { RefreshToken } from '../domain/refresh-token';

export interface AuthSession {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  isActive: boolean;
  emailVerified: boolean;
  token: string;
  expiresIn: number; // segundos de vida del access token
}

/** Lo que el caso de uso devuelve hacia dentro; el borde HTTP separa las dos partes. */
export interface AuthSessionWithRefresh {
  session: AuthSession;
  refreshToken: string; // valor en claro, destinado EXCLUSIVAMENTE a la cookie
}

export function buildAuthSession(
  user: UserAccount,
  issuer: TokenIssuerPort,
): AuthSession {
  return {
    id: user.id!,
    email: user.email.value,
    fullName: user.fullName,
    roles: user.roles,
    isActive: user.isActive,
    emailVerified: user.isEmailVerified,
    token: issuer.issueAccessToken({ id: user.id! }),
    expiresIn: issuer.accessTokenTtlSeconds(),
  };
}

/**
 * Abre una sesión de refresh: emite un token opaco nuevo (familia nueva), lo
 * persiste hasheado y devuelve el valor en claro para que el borde HTTP lo fije
 * en la cookie. Compartido por el inicio de sesión local, el registro y Google.
 */
export async function issueRefreshFor(
  user: UserAccount,
  issuer: TokenIssuerPort,
  refreshTokens: RefreshTokenRepositoryPort,
  now: Date,
  ttlDays: number,
): Promise<string> {
  const { raw, hash, familyId } = issuer.issueRefreshToken();
  await refreshTokens.save(
    RefreshToken.issue({
      userId: user.id!,
      tokenHash: hash,
      now,
      ttlDays,
      familyId,
    }),
  );
  return raw;
}

import { UserAccount } from '../domain/user-account';
import { TokenIssuerPort } from '../domain/ports/token-issuer.port';

export interface AuthSession {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  isActive: boolean;
  emailVerified: boolean;
  token: string;
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
  };
}

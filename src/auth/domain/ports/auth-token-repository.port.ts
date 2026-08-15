import { AuthToken } from '../auth-token';
import { AuthTokenType } from '../auth-token-type';

export interface AuthTokenRepositoryPort {
  save(token: AuthToken): Promise<AuthToken>;
  findByHash(type: AuthTokenType, tokenHash: string): Promise<AuthToken | null>;
  /** Marca como usados todos los tokens vigentes de ese tipo (regla 4). */
  invalidateAllOfType(
    userId: string,
    type: AuthTokenType,
    now: Date,
  ): Promise<void>;
}

import { AuthTokenOrmEntity } from './auth-token.orm-entity';
import { AuthToken } from '../../domain/auth-token';
import { AuthTokenType } from '../../domain/auth-token-type';

export class AuthTokenMapper {
  static toDomain(row: AuthTokenOrmEntity): AuthToken {
    return AuthToken.fromPersistence({
      id: row.id,
      userId: row.userId,
      type: row.type as AuthTokenType,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt ?? null,
      createdAt: row.createdAt,
    });
  }

  static toOrm(token: AuthToken): Partial<AuthTokenOrmEntity> {
    const orm: Partial<AuthTokenOrmEntity> = {
      userId: token.userId,
      type: token.type,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      usedAt: token.usedAt,
    };
    if (token.id) orm.id = token.id;
    return orm;
  }
}

import { RefreshTokenOrmEntity } from './refresh-token.orm-entity';
import { RefreshToken } from '../../domain/refresh-token';

export class RefreshTokenMapper {
  static toDomain(row: RefreshTokenOrmEntity): RefreshToken {
    return RefreshToken.fromPersistence({
      id: row.id,
      userId: row.userId,
      familyId: row.familyId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt ?? null,
      replacedByHash: row.replacedByHash ?? null,
      createdAt: row.createdAt,
    });
  }

  static toOrm(token: RefreshToken): Partial<RefreshTokenOrmEntity> {
    const orm: Partial<RefreshTokenOrmEntity> = {
      userId: token.userId,
      familyId: token.familyId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      revokedAt: token.revokedAt,
      replacedByHash: token.replacedByHash,
    };
    if (token.id) orm.id = token.id;
    return orm;
  }
}

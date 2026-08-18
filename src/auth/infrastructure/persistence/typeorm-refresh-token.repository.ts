import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RefreshTokenOrmEntity } from './refresh-token.orm-entity';
import { RefreshToken } from '../../domain/refresh-token';
import { RefreshTokenRepositoryPort } from '../../domain/ports/refresh-token-repository.port';
import { RefreshTokenMapper } from './refresh-token.mapper';

@Injectable()
export class TypeOrmRefreshTokenRepository
  implements RefreshTokenRepositoryPort
{
  constructor(
    @InjectRepository(RefreshTokenOrmEntity)
    private readonly repo: Repository<RefreshTokenOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async save(token: RefreshToken): Promise<RefreshToken> {
    const saved = await this.repo.save(
      this.repo.create(RefreshTokenMapper.toOrm(token)),
    );
    return RefreshTokenMapper.toDomain(saved);
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const row = await this.repo.findOne({ where: { tokenHash } });
    return row ? RefreshTokenMapper.toDomain(row) : null;
  }

  /**
   * Rotación en una sola transacción: persistir el consumido (revocado, con su
   * sucesor) y el emitido a la vez evita la ventana en la que el viejo ya no
   * vale y el nuevo aún no existe, que dejaría al usuario sin sesión.
   */
  async saveRotation(
    consumed: RefreshToken,
    issued: RefreshToken,
  ): Promise<RefreshToken> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RefreshTokenOrmEntity);
      await repo.update(
        { tokenHash: consumed.tokenHash },
        {
          revokedAt: consumed.revokedAt,
          replacedByHash: consumed.replacedByHash,
        },
      );
      const saved = await repo.save(
        repo.create(RefreshTokenMapper.toOrm(issued)),
      );
      return RefreshTokenMapper.toDomain(saved);
    });
  }

  async revokeFamily(familyId: string, now: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: now })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  async revokeAllOfUser(userId: string, now: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: now })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }
}

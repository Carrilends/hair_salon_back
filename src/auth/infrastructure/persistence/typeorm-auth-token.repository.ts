import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthTokenOrmEntity } from './auth-token.orm-entity';
import { AuthToken } from '../../domain/auth-token';
import { AuthTokenType } from '../../domain/auth-token-type';
import { AuthTokenRepositoryPort } from '../../domain/ports/auth-token-repository.port';
import { AuthTokenMapper } from './auth-token.mapper';

@Injectable()
export class TypeOrmAuthTokenRepository implements AuthTokenRepositoryPort {
  constructor(
    @InjectRepository(AuthTokenOrmEntity)
    private readonly repo: Repository<AuthTokenOrmEntity>,
  ) {}

  async save(token: AuthToken): Promise<AuthToken> {
    const saved = await this.repo.save(
      this.repo.create(AuthTokenMapper.toOrm(token)),
    );
    return AuthTokenMapper.toDomain(saved);
  }

  async findByHash(
    type: AuthTokenType,
    tokenHash: string,
  ): Promise<AuthToken | null> {
    const row = await this.repo.findOne({ where: { type, tokenHash } });
    return row ? AuthTokenMapper.toDomain(row) : null;
  }

  async invalidateAllOfType(
    userId: string,
    type: AuthTokenType,
    now: Date,
  ): Promise<void> {
    // Marca como usados todos los tokens vigentes (aún no usados) de ese tipo.
    await this.repo.update({ userId, type, usedAt: IsNull() }, { usedAt: now });
  }
}

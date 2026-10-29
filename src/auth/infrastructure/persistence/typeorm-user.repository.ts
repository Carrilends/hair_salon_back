import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { UserAccount } from '../../domain/user-account';
import { Email } from '../../domain/email';
import {
  LockedAccount,
  UserRepositoryPort,
} from '../../domain/ports/user-repository.port';
import { UserNotFoundError } from '../../domain/errors';
import { UserMapper } from './user.mapper';

// `password` es `select: false`: hay que pedirla explícitamente para no perder
// el hash al reconstruir y volver a guardar el agregado (riesgo nº 3).
const SELECT_WITH_PASSWORD: (keyof User)[] = [
  'id',
  'email',
  'password',
  'googleId',
  'fullName',
  'roles',
  'isActive',
  'emailVerifiedAt',
  'dataPolicyAcceptedAt',
];

@Injectable()
export class TypeOrmUserRepository implements UserRepositoryPort {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async findById(id: string): Promise<UserAccount | null> {
    const row = await this.repo.findOne({
      where: { id },
      select: SELECT_WITH_PASSWORD,
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<UserAccount | null> {
    const row = await this.repo.findOne({
      where: { email: email.value },
      select: SELECT_WITH_PASSWORD,
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByGoogleId(googleId: string): Promise<UserAccount | null> {
    const row = await this.repo.findOne({
      where: { googleId },
      select: SELECT_WITH_PASSWORD,
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const count = await this.repo.count({ where: { email: email.value } });
    return count > 0;
  }

  async save(user: UserAccount): Promise<UserAccount> {
    const saved = await this.repo.save(
      this.repo.create(UserMapper.toOrm(user)),
    );
    // Recargar con la contraseña para devolver un agregado consistente.
    const row = await this.repo.findOne({
      where: { id: saved.id },
      select: SELECT_WITH_PASSWORD,
    });
    return UserMapper.toDomain(row!);
  }

  async lockForDeletion(
    tx: EntityManager,
    id: string,
  ): Promise<LockedAccount | null> {
    const row = await tx.getRepository(User).findOne({
      select: { id: true, fullName: true, email: true, roles: true },
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return row
      ? { fullName: row.fullName, email: row.email, roles: row.roles }
      : null;
  }

  async deleteWithin(tx: EntityManager, id: string): Promise<void> {
    const result = await tx.getRepository(User).delete({ id });
    if (result.affected !== 1) throw new UserNotFoundError();
  }
}

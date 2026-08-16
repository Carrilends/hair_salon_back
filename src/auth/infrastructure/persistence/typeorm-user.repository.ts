import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { UserAccount } from '../../domain/user-account';
import { Email } from '../../domain/email';
import { UserRepositoryPort } from '../../domain/ports/user-repository.port';
import { UserMapper } from './user.mapper';

// `password` es `select: false`: hay que pedirla explícitamente para no perder
// el hash al reconstruir y volver a guardar el agregado (riesgo nº 3).
const SELECT_WITH_PASSWORD: (keyof User)[] = [
  'id',
  'email',
  'password',
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

  async existsByEmail(email: Email): Promise<boolean> {
    const count = await this.repo.count({ where: { email: email.value } });
    return count > 0;
  }

  async save(user: UserAccount): Promise<UserAccount> {
    const saved = await this.repo.save(this.repo.create(UserMapper.toOrm(user)));
    // Recargar con la contraseña para devolver un agregado consistente.
    const row = await this.repo.findOne({
      where: { id: saved.id },
      select: SELECT_WITH_PASSWORD,
    });
    return UserMapper.toDomain(row!);
  }
}

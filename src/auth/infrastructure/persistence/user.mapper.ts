import { User } from 'src/auth/entities/user.entity';
import { UserAccount } from '../../domain/user-account';
import { Email } from '../../domain/email';

export class UserMapper {
  static toDomain(row: User): UserAccount {
    return UserAccount.fromPersistence({
      id: row.id,
      email: Email.create(row.email),
      passwordHash: row.password,
      fullName: row.fullName,
      roles: row.roles,
      isActive: row.isActive,
      emailVerifiedAt: row.emailVerifiedAt ?? null,
      dataPolicyAcceptedAt: row.dataPolicyAcceptedAt ?? null,
    });
  }

  /**
   * Escribe SIEMPRE `password` con el hash del agregado. Por eso el repositorio
   * debe leer esa columna (`select: false`) antes de guardar: de lo contrario
   * `passwordHash` vendría indefinido y se borraría el hash (riesgo nº 3).
   */
  static toOrm(user: UserAccount): Partial<User> {
    const orm: Partial<User> = {
      email: user.email.value,
      password: user.passwordHash,
      fullName: user.fullName,
      roles: user.roles,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      dataPolicyAcceptedAt: user.dataPolicyAcceptedAt,
    };
    if (user.id) orm.id = user.id;
    return orm;
  }
}

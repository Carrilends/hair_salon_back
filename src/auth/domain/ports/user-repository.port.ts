import { UserAccount } from '../user-account';
import { Email } from '../email';

export interface UserRepositoryPort {
  findById(id: string): Promise<UserAccount | null>;
  /** Incluye el hash de la contraseña: la columna es `select: false` en el ORM. */
  findByEmail(email: Email): Promise<UserAccount | null>;
  /** Inicio de sesión con Google recurrente: localiza por el `sub` de Google. */
  findByGoogleId(googleId: string): Promise<UserAccount | null>;
  existsByEmail(email: Email): Promise<boolean>;
  save(user: UserAccount): Promise<UserAccount>;
}

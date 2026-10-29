import { EntityManager } from 'typeorm';
import { UserAccount } from '../user-account';
import { Email } from '../email';

/** La fila del usuario leída bajo `FOR UPDATE` al eliminar la cuenta. */
export interface LockedAccount {
  fullName: string;
  email: string;
  roles: string[];
}

export interface UserRepositoryPort {
  findById(id: string): Promise<UserAccount | null>;
  /** Incluye el hash de la contraseña: la columna es `select: false` en el ORM. */
  findByEmail(email: Email): Promise<UserAccount | null>;
  /** Inicio de sesión con Google recurrente: localiza por el `sub` de Google. */
  findByGoogleId(googleId: string): Promise<UserAccount | null>;
  existsByEmail(email: Email): Promise<boolean>;
  save(user: UserAccount): Promise<UserAccount>;
  /**
   * Eliminar la cuenta: bloquea la fila del usuario (`FOR UPDATE`) dentro de la
   * transacción y devuelve lo que el caso de uso necesita leído **bajo el
   * bloqueo** (nombre, correo y roles), para que un cambio de nombre, de correo
   * o de rol hecho en paralelo no se cuele entre la lectura y el borrado.
   * Mientras dure, nadie puede crear una reserva ligada a esa cuenta (la clave
   * foránea necesita leer la fila), así que ninguna escapa a la copia de datos.
   * Devuelve `null` si la cuenta ya no existe.
   */
  lockForDeletion(tx: EntityManager, id: string): Promise<LockedAccount | null>;
  /**
   * Borra la fila del usuario dentro de la transacción. Las claves se llevan
   * sus `refresh_tokens` y `auth_tokens` (CASCADE) y dejan sin cuenta sus
   * reservas (SET NULL). Lanza si no borró exactamente una fila.
   */
  deleteWithin(tx: EntityManager, id: string): Promise<void>;
}

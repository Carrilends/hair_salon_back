import { EntityManager } from 'typeorm';
import { AccountContact } from '../account-deletion';

/**
 * Lo que la eliminación de cuenta necesita del contexto de reservas. Recibe el
 * `EntityManager` de la transacción del caso de uso para que la copia ocurra en
 * la misma transacción que el borrado del usuario.
 */
export interface AccountReservationsPort {
  /**
   * Copia nombre y correo en las reservas vigentes de la cuenta (reglas de
   * `handOverFor`). No cancela nada ni pone `user_id` a `NULL`: eso lo hace la
   * clave `ON DELETE SET NULL` al borrar el usuario.
   *
   * @returns `vigentes`: reservas vigentes de la cuenta; `detached`: todas sus
   * reservas, que quedarán sin cuenta al borrarla.
   */
  handOverAndDetach(
    tx: EntityManager,
    userId: string,
    account: AccountContact,
    now: Date,
  ): Promise<{ vigentes: number; detached: number }>;
}

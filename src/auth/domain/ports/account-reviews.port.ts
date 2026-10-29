import { EntityManager } from 'typeorm';

/** Lo que la eliminación de cuenta necesita del contexto de reseñas. */
export interface AccountReviewsPort {
  /**
   * Deja las reseñas de la cuenta con el nombre genérico
   * (`ANONYMOUS_REVIEW_NAME`) y borra sus vínculos en `reviewsByUser`, que no
   * tienen `ON DELETE` e impedirían borrar el usuario. Texto y calificación se
   * conservan.
   *
   * @returns cuántas reseñas se anonimizaron.
   */
  anonymize(tx: EntityManager, userId: string): Promise<number>;
}

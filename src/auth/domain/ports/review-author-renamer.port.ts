/**
 * Desacopla Auth de Reviews: hoy `AuthService#updateProfile` escribe
 * directamente en los repositorios de `Review` y `ReviewByUser`.
 */
export interface ReviewAuthorRenamerPort {
  rename(userId: string, newFullName: string): Promise<void>;
}

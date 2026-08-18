/**
 * Vigencias y opciones de la sesión de refresh, inyectadas como valor (token
 * `SESSION_CONFIG`). Se derivan de variables de entorno en el módulo (T6):
 * `REFRESH_TOKEN_TTL_DAYS` (default 30, S6).
 */
export interface SessionConfig {
  /** Días de vida de la familia de refresh; la rotación no la alarga. */
  refreshTtlDays: number;
  /** Mismo valor en milisegundos, para `maxAge` de la cookie (T6). */
  refreshTtlMs: number;
}

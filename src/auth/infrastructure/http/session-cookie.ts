import { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'marlene_rt';

/**
 * `path` restringe el envío a las rutas de sesión: el navegador no adjunta la
 * cookie en ninguna otra petición, lo que reduce su exposición.
 *
 * `sameSite` depende del despliegue (ver "Decisión estructural" del plan):
 *   - con el proxy de Netlify la API es primera parte  -> 'lax'
 *   - con llamada directa a Railway es tercera parte    -> 'none' + secure
 */
export function buildRefreshCookieOptions(maxAgeMs: number): CookieOptions {
  const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax') as
    | 'lax'
    | 'strict'
    | 'none';
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite,
    path: '/api/auth',
    maxAge: maxAgeMs,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

export function setRefreshCookie(
  res: Response,
  value: string,
  maxAgeMs: number,
): void {
  res.cookie(REFRESH_COOKIE_NAME, value, buildRefreshCookieOptions(maxAgeMs));
}

/**
 * Limpiar exige repetir EXACTAMENTE los mismos atributos con los que se fijó
 * (path, sameSite, secure, domain) o el navegador ignora el borrado y el usuario
 * sigue con sesión pese a haber cerrado sesión.
 */
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...buildRefreshCookieOptions(0),
    maxAge: undefined,
  });
}

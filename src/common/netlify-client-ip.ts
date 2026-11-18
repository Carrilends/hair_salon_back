import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import { verify } from 'jsonwebtoken';

/**
 * La IP de la clienta cuando la petición llega por el proxy de Netlify.
 *
 * Medido en producción el 2026-11-17: el proxy `/api/*` de Netlify no deja la
 * IP de la clienta en `X-Forwarded-For` en una posición fija, así que contar
 * saltos (`TRUST_PROXY_HOPS`) daba una IP de Netlify distinta en cada petición
 * y el tope por origen del asistente contaba por nodo de Netlify, no por
 * clienta.
 *
 * Netlify sí la manda en `x-nf-client-connection-ip`, pero esa cabecera la
 * puede escribir cualquiera que llame a la API directamente (Railway expone su
 * propio dominio). Por eso solo se cree cuando la petición trae además
 * `x-nf-sign`: la firma que Netlify añade a un proxy declarado con
 * `signed = "<VARIABLE>"` en `netlify.toml` (JWS HMAC HS256 con `iss: netlify`
 * y caducidad), hecha con un secreto que solo conocen Netlify y la API
 * (`NETLIFY_PROXY_SECRET`). Sin secreto, sin firma o con firma inválida, no se
 * toca nada y manda `req.ip` como siempre.
 */
export const CABECERA_FIRMA_NETLIFY = 'x-nf-sign';
export const CABECERA_IP_NETLIFY = 'x-nf-client-connection-ip';

type Cabeceras = Record<string, string | string[] | undefined>;

function primera(valor: string | string[] | undefined): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v?.trim() || undefined;
}

export function ipDeLaClientaSegunNetlify(
  cabeceras: Cabeceras,
  secreto: string | undefined,
): string | null {
  if (!secreto) return null;

  const firma = primera(cabeceras[CABECERA_FIRMA_NETLIFY]);
  if (!firma) return null;

  try {
    // `algorithms` fijo: sin él, una firma con `alg: none` podría colarse.
    // `verify` comprueba también `exp`.
    verify(firma, secreto, { algorithms: ['HS256'], issuer: 'netlify' });
  } catch {
    return null;
  }

  const ip = primera(cabeceras[CABECERA_IP_NETLIFY]);
  if (!ip || isIP(ip) === 0) return null;
  return ip;
}

/**
 * Middleware global: con una firma válida, `req.ip` pasa a ser la IP de la
 * clienta. Todo lo que ya leía `req.ip` (el tope por origen del asistente y
 * `GET /api/health`) sigue igual y simplemente ve la dirección correcta.
 */
export function middlewareIpDeNetlify(secreto: string | undefined) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const ip = ipDeLaClientaSegunNetlify(req.headers, secreto);
    if (ip) {
      // `req.ip` es un getter del prototipo de Express: se sombrea con una
      // propiedad propia solo para esta petición.
      Object.defineProperty(req, 'ip', {
        value: ip,
        configurable: true,
        enumerable: true,
      });
    }
    next();
  };
}

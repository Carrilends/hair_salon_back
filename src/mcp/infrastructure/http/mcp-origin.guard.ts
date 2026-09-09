import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  localhostAllowedOrigins,
  validateOriginHeader,
} from '@modelcontextprotocol/server';

/**
 * Validacion de la cabecera `Origin`, **exigida por la especificacion** (MUST):
 * si esta presente y no es valida, la respuesta es **403**.
 *
 * Es la unica obligacion del transporte que el SDK deja a cargo de quien lo monta
 * —el resto (`server/discover`, `-32020` de cabecera contra cuerpo, `405` en
 * `GET`/`DELETE`, `resultType`) las resuelve el propio manejador—, y protege
 * frente al **reenlace de DNS**: sin ella, una pagina web cualquiera abierta en el
 * navegador de la clienta podria emitir peticiones contra este servidor.
 *
 * Una peticion **sin** `Origin` pasa: los clientes MCP de escritorio no envian esa
 * cabecera, y solo las peticiones nacidas en un navegador llevan la que este
 * control vigila.
 */
@Injectable()
export class McpOriginGuard implements CanActivate {
  /**
   * Nombres de maquina admitidos (sin esquema ni puerto). Sin
   * `MCP_ALLOWED_ORIGINS` solo se admite localhost, que es lo util en desarrollo
   * y lo prudente en cualquier otro sitio: un despliegue publico debe declarar
   * su dominio de forma explicita.
   */
  private readonly allowed: string[];

  constructor() {
    const declarados = (process.env.MCP_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    this.allowed =
      declarados.length > 0 ? declarados : localhostAllowedOrigins();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const origin = request.headers.origin;

    const resultado = validateOriginHeader(
      typeof origin === 'string' ? origin : undefined,
      this.allowed,
    );
    // El estrechamiento de la union no funciona aqui porque el proyecto compila
    // con `strictNullChecks: false`; de ahi la asercion sobre la rama de fallo.
    if (!resultado.ok) {
      throw new ForbiddenException((resultado as { message: string }).message);
    }

    return true;
  }
}

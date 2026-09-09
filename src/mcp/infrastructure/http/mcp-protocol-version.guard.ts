import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';

/** Código `HeaderMismatch` de la especificación (rango reservado `-32020..-32099`). */
export const HEADER_MISMATCH = -32020;

/**
 * Exige la cabecera `MCP-Protocol-Version` en cada `POST`, como manda la
 * especificacion: *"Every POST request to the MCP endpoint MUST include an
 * `MCP-Protocol-Version` header"*, y su ausencia es uno de los casos de
 * `HeaderMismatch`.
 *
 * **Por que hace falta este guard.** El manejador del SDK cubre casi todas las
 * obligaciones de cabecera —exige `Mcp-Method`, exige `Mcp-Name` en `tools/call`,
 * y rechaza con `-32020` cuando cualquiera de las dos no coincide con el cuerpo—,
 * pero **deduce la version del sobre `_meta` cuando la cabecera falta** y sirve la
 * peticion igualmente. Se comprobo con una prueba. La diferencia importa: la razon
 * de ser de estas cabeceras es que un intermediario pueda encaminar **sin abrir el
 * cuerpo**, de modo que aceptar una peticion que solo trae la version por dentro
 * anula la garantia.
 *
 * Se limita a `POST` a proposito: `GET` y `DELETE` deben seguir recibiendo el
 * `405` del transporte, no un 400.
 */
@Injectable()
export class McpProtocolVersionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      method: string;
      headers: Record<string, string | string[] | undefined>;
    }>();

    if (request.method !== 'POST') return true;
    if (request.headers['mcp-protocol-version']) return true;

    throw new BadRequestException({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: HEADER_MISMATCH,
        message: 'Falta la cabecera obligatoria MCP-Protocol-Version.',
      },
    });
  }
}

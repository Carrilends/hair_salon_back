import { All, Controller, Inject, Req, Res, UseGuards } from '@nestjs/common';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { Request, Response } from 'express';

import { ASSISTANT_TOOLS } from 'src/assistant/application/tokens';
import {
  AssistantContext,
  AssistantTool,
} from 'src/assistant/application/tools/assistant-tool';
import { User } from 'src/auth/entities/user.entity';
import { ValidRoles } from 'src/auth/interfaces/valid-roles';
import { OptionalJwtAuthGuard } from 'src/reservations/infrastructure/http/optional-jwt-auth.guard';
import { buildMcpServer } from '../../application/mcp-tool-registry';
import { McpOriginGuard } from './mcp-origin.guard';
import { McpProtocolVersionGuard } from './mcp-protocol-version.guard';

/**
 * Superficie MCP del portal: una sola ruta bajo el prefijo global, `/api/mcp`.
 *
 * Tres detalles del borde HTTP que conviene no perder de vista:
 *
 * - **No se declara `@Body()` con una clase DTO.** La `ValidationPipe` global
 *   (`whitelist` + `forbidNonWhitelisted`, `src/main.ts`) rechazaria un cuerpo
 *   JSON-RPC, que lleva un `_meta` de forma abierta imposible de describir con un
 *   DTO cerrado. Tomando `@Req()`/`@Res()` el pipe no llega a verlo. Hay una
 *   prueba que lo fija.
 * - **El cuerpo ya viene analizado** por el analizador JSON de Nest, de modo que
 *   se le pasa al manejador para que no vuelva a leer el flujo.
 * - **La identidad sale del JWT y de ningun otro sitio.** Se reutiliza el mismo
 *   `OptionalJwtAuthGuard` que ya protege el asistente: no hay aqui ningun
 *   mecanismo de identidad nuevo, y ese es justamente el argumento de la fase.
 */
@UseGuards(McpOriginGuard, McpProtocolVersionGuard, OptionalJwtAuthGuard)
@Controller('mcp')
export class McpController {
  constructor(
    @Inject(ASSISTANT_TOOLS) private readonly tools: AssistantTool[],
  ) {}

  // `@All` y no `@Post`: la ruta tiene que **recibir** tambien `GET` y `DELETE`
  // para poder contestarles `405`, como manda la revision vigente al haber
  // eliminado el flujo por `GET` y las operaciones de sesion. Si Nest no las
  // encaminase, el cliente veria un 404 y no sabria que la ruta existe.
  @All()
  async mcp(
    @Req() req: Request & { user?: User | null },
    @Res() res: Response,
  ): Promise<void> {
    // Replica exacta del patron de `assistant.controller.ts`: sin sesion, `null`.
    // El rol de administracion se lee de la fila de usuario que la estrategia JWT
    // recupero, nunca de los argumentos de la llamada; una omision no concede
    // privilegios.
    const contexto: AssistantContext = {
      userId: req.user?.id ?? null,
      now: new Date(),
      isAdmin: req.user?.roles?.includes(ValidRoles.admin) ?? false,
    };

    // El manejador se construye por peticion para poder cerrar sobre el contexto
    // de identidad. El SDK ofrece un canal alternativo (`authInfo`), pero obliga
    // a fabricar un objeto de OAuth ficticio; asi la ruta que sigue la identidad
    // queda a la vista, que es lo que hay que poder demostrar. El servidor MCP ya
    // era efimero de todos modos: la revision `2026-07-28` no tiene sesiones.
    const handler = createMcpHandler(
      () => buildMcpServer(this.tools, contexto),
      // Solo la revision `2026-07-28`. Por defecto el SDK sirve tambien el
      // trafico de 2025 sin sobre `_meta` ni cabecera de version, y eso dejaria
      // sin efecto obligaciones que la tesis afirma cumplir.
      { legacy: 'reject' },
    );

    await toNodeHandler(handler)(req, res, req.body);
  }
}

import { All, Controller, Inject, Req, Res, UseGuards } from '@nestjs/common';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { Request, Response } from 'express';

import { ASSISTANT_TOOLS } from 'src/assistant/application/tokens';
import { AssistantTool } from 'src/assistant/application/tools/assistant-tool';
import { buildMcpServer } from '../../application/mcp-tool-registry';
import { McpOriginGuard } from './mcp-origin.guard';
import { McpProtocolVersionGuard } from './mcp-protocol-version.guard';

/**
 * Superficie MCP del portal: una sola ruta `POST /api/mcp`.
 *
 * Dos detalles del borde HTTP que conviene no perder de vista:
 *
 * - **No se declara `@Body()` con una clase DTO.** La `ValidationPipe` global
 *   (`whitelist` + `forbidNonWhitelisted`, `src/main.ts`) rechazaria un cuerpo
 *   JSON-RPC, que lleva un `_meta` de forma abierta imposible de describir con un
 *   DTO cerrado. Tomando `@Req()`/`@Res()` el pipe no llega a verlo. Hay una
 *   prueba que lo fija.
 * - **El cuerpo ya viene analizado** por el analizador JSON de Nest, de modo que
 *   se le pasa al manejador para que no vuelva a leer el flujo.
 */
@UseGuards(McpOriginGuard, McpProtocolVersionGuard)
@Controller('mcp')
export class McpController {
  private readonly handle: (
    req: Request,
    res: Response,
    body?: unknown,
  ) => Promise<void>;

  constructor(
    @Inject(ASSISTANT_TOOLS) private readonly tools: AssistantTool[],
  ) {
    // La factoria se invoca por peticion: el servidor es efimero y sin estado,
    // que es justo lo que permite la revision `2026-07-28` al eliminar las
    // sesiones de protocolo.
    this.handle = toNodeHandler(
      createMcpHandler(
        () =>
          buildMcpServer(this.tools, {
            userId: null,
            now: new Date(),
            isAdmin: false,
          }),
        // Solo la revision `2026-07-28`. Por defecto el SDK sirve tambien el
        // trafico de 2025 sin sobre `_meta` ni cabecera de version, y eso dejaria
        // sin efecto obligaciones que la tesis afirma cumplir. `reject` responde
        // a ese trafico con el error de version no admitida.
        { legacy: 'reject' },
      ),
    );
  }

  // `@All` y no `@Post`: la ruta tiene que **recibir** tambien `GET` y `DELETE`
  // para poder contestarles `405`, como manda la revision vigente al haber
  // eliminado el flujo por `GET` y las operaciones de sesion. Si Nest no las
  // encaminase, el cliente veria un 404 y no sabria que la ruta existe.
  @All()
  async mcp(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handle(req, res, req.body);
  }
}

import { Module } from '@nestjs/common';

import { AssistantModule } from 'src/assistant/assistant.module';
import { McpController } from './infrastructure/http/mcp.controller';
import { McpOriginGuard } from './infrastructure/http/mcp-origin.guard';
import { McpProtocolVersionGuard } from './infrastructure/http/mcp-protocol-version.guard';

/**
 * Superficie MCP. Es **aditiva**: no aporta ninguna herramienta propia ni ninguna
 * regla de negocio, solo publica por un protocolo estandar el arreglo
 * `ASSISTANT_TOOLS` que ya construye `AssistantModule`. Por eso su unica
 * dependencia es ese modulo.
 */
@Module({
  imports: [AssistantModule],
  controllers: [McpController],
  providers: [McpOriginGuard, McpProtocolVersionGuard],
})
export class McpModule {}

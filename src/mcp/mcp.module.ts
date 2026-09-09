import { Module } from '@nestjs/common';

import { AssistantModule } from 'src/assistant/assistant.module';
import { AuthModule } from 'src/auth/auth.module';
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
  // `AuthModule` por el `OptionalJwtAuthGuard`: exporta la estrategia JWT y
  // `PassportModule`, igual que hacen `AssistantModule` y `ReservationsModule`.
  imports: [AssistantModule, AuthModule],
  controllers: [McpController],
  providers: [McpOriginGuard, McpProtocolVersionGuard],
})
export class McpModule {}

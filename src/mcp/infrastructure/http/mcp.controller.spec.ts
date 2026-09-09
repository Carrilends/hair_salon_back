import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AssistantTool } from 'src/assistant/application/tools/assistant-tool';
import { ASSISTANT_TOOLS } from 'src/assistant/application/tokens';
import { McpController } from './mcp.controller';
import { MCP_PROTOCOL_VERSION } from '../../application/mcp-tool-registry';

/** El esquema que publica la herramienta falsa. Se compara por igualdad mas abajo. */
const ESQUEMA_LISTAR: Record<string, unknown> = {
  type: 'object',
  properties: { busqueda: { type: 'string', description: 'Texto a buscar' } },
  required: [],
  additionalProperties: false,
};

class ListarServiciosFalsa implements AssistantTool {
  readonly name = 'listarServicios';
  readonly definition = {
    name: 'listarServicios',
    description: 'Lista los servicios del catalogo.',
    parameters: ESQUEMA_LISTAR,
  };
  async execute(): Promise<unknown> {
    return [{ nombre: 'Corte dama' }];
  }
}

class ConsultarDisponibilidadFalsa implements AssistantTool {
  readonly name = 'consultarDisponibilidad';
  readonly definition = {
    name: 'consultarDisponibilidad',
    description: 'Consulta la disponibilidad de un dia.',
    parameters: { type: 'object', properties: {}, required: [] },
  };
  async execute(): Promise<unknown> {
    return { libres: [] };
  }
}

/**
 * El sobre `_meta` que la revision `2026-07-28` exige en cada peticion: al
 * desaparecer `initialize`, la version y las capacidades del cliente viajan aqui,
 * y la version DEBE coincidir con la de la cabecera.
 */
const sobre = () => ({
  'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
  'io.modelcontextprotocol/clientInfo': { name: 'jest', version: '0' },
  'io.modelcontextprotocol/clientCapabilities': {},
});

describe('McpController (HTTP)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        {
          provide: ASSISTANT_TOOLS,
          useValue: [
            new ListarServiciosFalsa(),
            new ConsultarDisponibilidadFalsa(),
          ],
        },
      ],
    }).compile();

    app = modulo.createNestApplication();
    // Se replica el borde real de `src/main.ts`: sin esto la prueba no diria nada
    // sobre el riesgo que existe en produccion.
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('acepta un cuerpo JSON-RPC completo sin rechazarlo por validacion', async () => {
    // La app aplica `whitelist` + `forbidNonWhitelisted` globalmente, y un cuerpo
    // JSON-RPC lleva campos abiertos (`_meta` anidado) que ningun DTO cerrado
    // puede describir. Esta prueba fija que la ruta los acepta.
    const respuesta = await request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .set('Mcp-Method', 'tools/list')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: sobre() },
      });

    expect(respuesta.status).not.toBe(400);
  });

  it('publica en tools/list las herramientas del registro interno', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .set('Mcp-Method', 'tools/list')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: sobre() },
      });

    const nombres = body.result.tools.map((t: { name: string }) => t.name);
    expect(nombres).toEqual(['listarServicios', 'consultarDisponibilidad']);
  });

  it('publica el esquema del contrato interno, no una copia reescrita para MCP', async () => {
    // M8. Si alguien duplicara las definiciones para MCP, esta prueba caeria y
    // con ella el argumento central de la fase.
    const { body } = await request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .set('Mcp-Method', 'tools/list')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: sobre() },
      });

    const listar = body.result.tools.find(
      (t: { name: string }) => t.name === 'listarServicios',
    );
    expect(listar.inputSchema).toEqual(ESQUEMA_LISTAR);
    expect(listar.description).toBe('Lista los servicios del catalogo.');
  });
});

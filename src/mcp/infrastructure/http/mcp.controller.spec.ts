import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AssistantTool } from 'src/assistant/application/tools/assistant-tool';
import { ASSISTANT_TOOLS } from 'src/assistant/application/tokens';
import { OptionalJwtAuthGuard } from 'src/reservations/infrastructure/http/optional-jwt-auth.guard';
import { McpController } from './mcp.controller';
import { McpOriginGuard } from './mcp-origin.guard';
import { McpProtocolVersionGuard } from './mcp-protocol-version.guard';
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

/** Una herramienta cuyo caso de uso revienta: el turno no debe romperse por ello. */
class HerramientaQueRevienta implements AssistantTool {
  readonly name = 'reventar';
  readonly definition = {
    name: 'reventar',
    description: 'Falla siempre.',
    parameters: { type: 'object', properties: {}, required: [] },
  };
  async execute(): Promise<unknown> {
    throw new Error('el catalogo no responde');
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
            new HerramientaQueRevienta(),
          ],
        },
        McpOriginGuard,
        McpProtocolVersionGuard,
      ],
    })
      // Estas pruebas van del transporte, no de la identidad: el guard real
      // necesitaria Passport levantado. Se sustituye por uno que deja la
      // peticion anonima, que es el caso que aqui interesa.
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

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
    expect(nombres).toEqual([
      'listarServicios',
      'consultarDisponibilidad',
      'reventar',
    ]);
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

  /** Atajo para `tools/call`, con las cabeceras que la especificacion exige. */
  const llamar = (name: string, args: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .set('Mcp-Method', 'tools/call')
      .set('Mcp-Name', name)
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name, arguments: args, _meta: sobre() },
      });

  it('ejecuta la herramienta y devuelve su resultado como contenido de texto', async () => {
    const { body } = await llamar('listarServicios', { busqueda: 'corte' });

    expect(body.result.content[0].type).toBe('text');
    expect(JSON.parse(body.result.content[0].text)[0]).toHaveProperty(
      'nombre',
      'Corte dama',
    );
    // En el camino feliz el SDK omite `isError`; el campo es opcional y su
    // ausencia significa exito.
    expect(body.result.isError).toBeUndefined();
  });

  it('marca isError y explica el motivo cuando la herramienta revienta', async () => {
    // Un fallo de dominio no puede tumbar el turno ni salir como un 500 opaco con
    // una traza: el cliente tiene que poder leerlo y reaccionar.
    const { status, body } = await llamar('reventar');

    expect(status).toBe(200);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain('el catalogo no responde');
    expect(body.result.content[0].text).not.toContain('at ');
  });

  it('responde con un error JSON-RPC cuando la herramienta no existe', async () => {
    const { body } = await llamar('herramientaInventada');

    expect(body.error).toBeDefined();
    expect(body.result).toBeUndefined();
    // `-32602` (*Invalid params*), no `-32601` (*Method not found*): `tools/call`
    // SI es un metodo conocido: lo desconocido es el nombre de la herramienta, que
    // viaja como parametro. El plan de la fase suponia `-32601` y estaba
    // equivocado; esta prueba fija el codigo que devuelve el transporte conforme.
    expect(body.error.code).toBe(-32602);
  });

  // --- Conformidad del transporte (T3) -------------------------------------
  //
  // De las cinco obligaciones, la de `Origin` es la unica que implementa este
  // proyecto; las otras las resuelve el manejador del SDK. Se prueban todas
  // igualmente: lo que la tesis afirma es que el endpoint es conforme, y eso hay
  // que poder demostrarlo sin importar quien escribio cada linea.

  it('rechaza con 403 una peticion con Origin no permitido', async () => {
    const { status } = await request(app.getHttpServer())
      .post('/api/mcp')
      .set('Origin', 'https://sitio-atacante.example')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .set('Mcp-Method', 'tools/list')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: sobre() },
      });

    expect(status).toBe(403);
  });

  it('rechaza con 400 y -32020 cuando falta la cabecera MCP-Protocol-Version', async () => {
    const { status, body } = await request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('Mcp-Method', 'tools/list')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: sobre() },
      });

    expect(status).toBe(400);
    expect(body.error.code).toBe(-32020);
  });

  it('rechaza con 400 y -32020 cuando falta la cabecera Mcp-Method', async () => {
    const { status, body } = await request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: sobre() },
      });

    expect(status).toBe(400);
    expect(body.error.code).toBe(-32020);
  });

  it('rechaza con 400 y -32020 cuando en tools/call falta Mcp-Name', async () => {
    const { status, body } = await request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .set('Mcp-Method', 'tools/call')
      .send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'listarServicios', arguments: {}, _meta: sobre() },
      });

    expect(status).toBe(400);
    expect(body.error.code).toBe(-32020);
  });

  it('rechaza con 400 y -32020 cuando Mcp-Name no coincide con el cuerpo', async () => {
    // La especificacion obliga a esta comprobacion porque un intermediario —un
    // balanceador, una pasarela— podria encaminar segun la cabecera mientras el
    // servidor ejecuta segun el cuerpo. Es una discrepancia de fuente de verdad.
    const { status, body } = await request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .set('Mcp-Method', 'tools/call')
      .set('Mcp-Name', 'listarServicios') // cabecera
      .send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'consultarDisponibilidad', // cuerpo distinto
          arguments: {},
          _meta: sobre(),
        },
      });

    expect(status).toBe(400);
    expect(body.error.code).toBe(-32020);
  });

  it('responde 405 a GET y DELETE sobre la ruta', async () => {
    // La revision vigente elimino el endpoint GET y las operaciones de sesion.
    await request(app.getHttpServer()).get('/api/mcp').expect(405);
    await request(app.getHttpServer()).delete('/api/mcp').expect(405);
  });
});

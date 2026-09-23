import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { ASSISTANT_TOOLS } from 'src/assistant/application/tokens';
import {
  AssistantContext,
  AssistantTool,
} from 'src/assistant/application/tools/assistant-tool';
import { OptionalJwtAuthGuard } from 'src/reservations/infrastructure/http/optional-jwt-auth.guard';
import { McpController } from './mcp.controller';
import { McpOriginGuard } from './mcp-origin.guard';
import { McpProtocolVersionGuard } from './mcp-protocol-version.guard';
import { MCP_PROTOCOL_VERSION } from '../../application/mcp-tool-registry';

const USUARIO_A = { id: 'usuario-a', roles: ['user'] };
const USUARIO_B_ID = 'usuario-b';

/**
 * Doble de `misReservas`: reproduce lo unico que importa aqui —que la identidad
 * sale del contexto y no de los argumentos— y **anota** con que la llamaron.
 */
class MisReservasEspia implements AssistantTool {
  readonly name = 'misReservas';
  readonly definition = {
    name: 'misReservas',
    description: 'Devuelve las reservas de la clienta.',
    // Vacio a proposito: el esquema publicado no tiene donde expresar "las
    // reservas de otra persona".
    parameters: { type: 'object', properties: {}, required: [] },
  };

  contextos: AssistantContext[] = [];
  argumentos: Record<string, unknown>[] = [];

  async execute(
    args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    this.argumentos.push(args);
    this.contextos.push(context);
    if (!context.userId) return { ok: false, motivo: 'sesion_requerida' };
    return { reservasDe: context.userId };
  }
}

const sobre = () => ({
  'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
  'io.modelcontextprotocol/clientInfo': { name: 'jest', version: '0' },
  'io.modelcontextprotocol/clientCapabilities': {},
});

describe('McpController — identidad', () => {
  let app: INestApplication;
  let espia: MisReservasEspia;
  /** Lo que el guard deja en `req.user`: null simula ausencia de sesion. */
  let usuarioDelToken: { id: string; roles: string[] } | null;

  beforeAll(async () => {
    espia = new MisReservasEspia();

    const modulo = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        { provide: ASSISTANT_TOOLS, useValue: [espia] },
        McpOriginGuard,
        McpProtocolVersionGuard,
      ],
    })
      // Se sustituye el guard real por uno que deja en `req.user` lo que la
      // prueba decida. Lo que se esta probando no es Passport —eso ya tiene sus
      // pruebas— sino que el controlador toma la identidad de ahi y de ningun
      // otro sitio.
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({
        canActivate: (contexto: {
          switchToHttp: () => { getRequest: () => { user: unknown } };
        }) => {
          contexto.switchToHttp().getRequest().user = usuarioDelToken;
          return true;
        },
      })
      .compile();

    app = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    // `listen(0)` y no `init()`: con la app sin escuchar, supertest abre y
    // cierra un servidor efimero POR PETICION sobre el mismo `http.Server`.
    // Con 113 suites en paralelo esa carrera se pierde de vez en cuando y la
    // respuesta se corta a medias (`socket hang up`). Escuchando una sola vez,
    // supertest reutiliza el puerto y no cierra nada; lo cierra el `afterAll`.
    await app.listen(0);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    espia.contextos = [];
    espia.argumentos = [];
  });

  const llamarMisReservas = (args: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .set('Mcp-Method', 'tools/call')
      .set('Mcp-Name', 'misReservas')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'misReservas', arguments: args, _meta: sobre() },
      });

  it('sin sesion, la herramienta de gestion se niega', async () => {
    usuarioDelToken = null;

    const { body } = await llamarMisReservas();

    expect(JSON.parse(body.result.content[0].text)).toEqual({
      ok: false,
      motivo: 'sesion_requerida',
    });
    expect(espia.contextos[0].userId).toBeNull();
  });

  it('con sesion, la identidad es la del token', async () => {
    usuarioDelToken = USUARIO_A;

    const { body } = await llamarMisReservas();

    expect(JSON.parse(body.result.content[0].text)).toEqual({
      reservasDe: USUARIO_A.id,
    });
  });

  it('ignora por completo un identificador colado en los argumentos', async () => {
    // Esta es la prueba que hay que enseñar cuando pregunten por inyeccion de
    // instrucciones. Un cliente MCP ajeno —o quien escriba en su chat— puede
    // mandar lo que quiera en `arguments`: la identidad sigue saliendo del JWT.
    usuarioDelToken = USUARIO_A;

    const { body } = await llamarMisReservas({ userId: USUARIO_B_ID });

    expect(espia.contextos[0].userId).toBe(USUARIO_A.id);
    expect(JSON.parse(body.result.content[0].text)).toEqual({
      reservasDe: USUARIO_A.id,
    });
    // El argumento llego a la herramienta —nadie lo filtra— y la herramienta lo
    // ignora porque no lo mira: no hay ninguna ruta por la que pueda influir.
    expect(espia.argumentos[0]).toEqual({ userId: USUARIO_B_ID });
  });

  it('toma el rol de administracion del token, nunca de la conversacion', async () => {
    usuarioDelToken = { id: 'admin-1', roles: ['user', 'admin'] };

    await llamarMisReservas({ isAdmin: true });

    expect(espia.contextos[0].isAdmin).toBe(true);

    usuarioDelToken = USUARIO_A;
    await llamarMisReservas({ isAdmin: true });

    expect(espia.contextos[1].isAdmin).toBe(false);
  });
});

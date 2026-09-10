import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { buildAssistantTools } from 'src/assistant/build-assistant-tools';
import { ASSISTANT_TOOLS } from 'src/assistant/application/tokens';
import { CancelReservationUseCase } from 'src/reservations/application/cancel-reservation.use-case';
import { Reservation } from 'src/reservations/domain/reservation';
import { OptionalJwtAuthGuard } from 'src/reservations/infrastructure/http/optional-jwt-auth.guard';
import { McpController } from './infrastructure/http/mcp.controller';
import { McpOriginGuard } from './infrastructure/http/mcp-origin.guard';
import { McpProtocolVersionGuard } from './infrastructure/http/mcp-protocol-version.guard';
import { MCP_PROTOCOL_VERSION } from './application/mcp-tool-registry';

/**
 * Las capacidades que este servidor publica a internet. **Ninguna es de
 * administracion**, y esa afirmacion es de las que sostiene la tesis.
 *
 * La lista esta escrita a mano a proposito: la superficie MCP publica el arreglo
 * `ASSISTANT_TOOLS` entero, de modo que **añadir una herramienta al asistente la
 * expone tambien aqui**. Si eso ocurre, esta prueba cae y obliga a decidirlo de
 * forma explicita en vez de dejar que se filtre en silencio. Es un cable trampa,
 * no un filtro: filtrar en tiempo de ejecucion daria una falsa sensacion de
 * seguridad sobre una lista que igualmente habria que mantener.
 */
const CAPACIDADES_PUBLICADAS = [
  'listarServicios',
  'consultarDisponibilidad',
  'crearReserva',
  'misReservas',
  'cancelarReserva',
  // Etapa 2 de WhatsApp: mover la propia cita es capacidad de clienta, igual que
  // cancelarla. El caso de uso vuelve a comprobar la propiedad.
  'reprogramarReserva',
  'recomendarServicios',
  'componerPaquete',
  'reservarPaquete',
];

const LINEAS = [
  { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
];

const reservaDe = (userId: string): Reservation =>
  Reservation.schedule({
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    workerId: 'w-1',
    userId,
    lines: LINEAS,
  });

const sobre = () => ({
  'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
  'io.modelcontextprotocol/clientInfo': { name: 'jest', version: '0' },
  'io.modelcontextprotocol/clientCapabilities': {},
});

describe('Superficie MCP — herramientas de gestion (T6)', () => {
  let app: INestApplication;
  let usuarioDelToken: { id: string; roles: string[] } | null;
  /** Estado que leen los dobles del repositorio y del reloj, por prueba. */
  let reservaGuardada: Reservation;
  let ahora: Date;

  beforeAll(async () => {
    // Se usa el caso de uso REAL de cancelacion sobre dobles de repositorio y
    // reloj: lo que hay que demostrar es que las reglas del dominio llegan
    // intactas hasta el cliente externo, no que un doble las imite.
    const cancelar = new CancelReservationUseCase(
      {
        findById: async () => reservaGuardada,
        save: async (r: Reservation) => r,
      } as never,
      { now: () => ahora } as never,
      {
        reservationCreated: async () => undefined,
        reservationCancelled: async () => undefined,
        reservationRescheduled: async () => undefined,
      } as never,
    );

    // Las demas dependencias solo se guardan por referencia al construir las
    // herramientas; `tools/list` no ejecuta ninguna.
    const tools = buildAssistantTools(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      cancelar as never,
      {} as never,
    );

    const modulo = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        { provide: ASSISTANT_TOOLS, useValue: tools },
        McpOriginGuard,
        McpProtocolVersionGuard,
      ],
    })
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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const llamar = (name: string, args: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/api/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('MCP-Protocol-Version', MCP_PROTOCOL_VERSION)
      .set('Mcp-Method', 'tools/call')
      .set('Mcp-Name', name)
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args, _meta: sobre() },
      });

  const resultadoDe = (body: {
    result: { content: { text: string }[] };
  }): unknown => JSON.parse(body.result.content[0].text);

  it('publica exactamente las capacidades de clienta, y ninguna de administracion', async () => {
    usuarioDelToken = null;

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

    expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual(
      CAPACIDADES_PUBLICADAS,
    );
  });

  it('las de gestion se publican siempre y se niegan sin sesion', async () => {
    // Decision de la fase: mostrarlas y rechazar, en vez de ocultarlas sin
    // sesion. Un `tools/list` que dependiera del token daria a los clientes dos
    // catalogos distintos del mismo servidor, y el rechazo ya es explicito.
    usuarioDelToken = null;

    const { body } = await llamar('crearReserva', {
      fechaHoraIso: '2026-04-20T15:00:00.000Z',
      serviciosIds: ['s1'],
    });

    expect(resultadoDe(body)).toEqual({
      ok: false,
      motivo: 'sesion_requerida',
    });
  });

  it('no deja cancelar la reserva de otra persona', async () => {
    // Segunda barrera: el esquema ya impide pedir "la reserva de otra", pero
    // ademas el caso de uso revalida la propiedad por su cuenta.
    usuarioDelToken = { id: 'intrusa', roles: ['user'] };
    reservaGuardada = reservaDe('duena');
    ahora = new Date('2026-04-20T14:00:00.000Z');

    const { body } = await llamar('cancelarReserva', { reservaId: 'r-1' });

    expect(resultadoDe(body)).toEqual({
      ok: false,
      motivo: 'no_es_tu_reserva',
    });
    expect(reservaGuardada.status).not.toBe('cancelada');
  });

  it('no deja cancelar pasada la hora si no hay rol de administracion', async () => {
    usuarioDelToken = { id: 'duena', roles: ['user'] };
    reservaGuardada = reservaDe('duena');
    ahora = new Date('2026-04-20T16:00:00.000Z');

    const { body } = await llamar('cancelarReserva', { reservaId: 'r-1' });

    expect(resultadoDe(body)).toEqual({ ok: false, motivo: 'fuera_de_plazo' });
  });

  it('con rol de administracion en el token, la misma cancelacion procede', async () => {
    usuarioDelToken = { id: 'admin-1', roles: ['user', 'admin'] };
    reservaGuardada = reservaDe('duena');
    ahora = new Date('2026-04-20T16:00:00.000Z');

    const { body } = await llamar('cancelarReserva', { reservaId: 'r-1' });

    expect(resultadoDe(body)).toEqual({ ok: true, estado: 'cancelada' });
  });
});

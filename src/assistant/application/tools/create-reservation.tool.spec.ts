import { CreateReservationTool } from './create-reservation.tool';
import { AssistantContext } from './assistant-tool';
import { WorkerOverlapError } from 'src/reservations/domain/errors';

const UUID = '11111111-1111-4111-8111-111111111111';

class FakeCreateReservation {
  calls = 0;
  constructor(private readonly behavior: (cmd: unknown) => unknown) {}
  async execute(cmd: unknown): Promise<unknown> {
    this.calls++;
    return this.behavior(cmd);
  }
}

function ctx(userId: string | null): AssistantContext {
  return { userId, now: new Date('2026-08-19T14:00:00Z'), isAdmin: false };
}

describe('CreateReservationTool', () => {
  it('sin sesión devuelve sesion_requerida y NO llama al caso de uso', async () => {
    const create = new FakeCreateReservation(() => {
      throw new Error('no debería llamarse');
    });
    const tool = new CreateReservationTool(create as never);
    const res = await tool.execute(
      { fechaHoraIso: '2026-08-20T14:00:00.000Z', serviciosIds: [UUID] },
      ctx(null),
    );
    expect(res).toEqual({ ok: false, motivo: 'sesion_requerida' });
    expect(create.calls).toBe(0);
  });

  it('con argumentos inválidos devuelve argumentos_invalidos sin llamar al caso de uso', async () => {
    const create = new FakeCreateReservation(() => ({
      id: 'r1',
      status: 'pendiente',
    }));
    const tool = new CreateReservationTool(create as never);
    const res = (await tool.execute(
      { fechaHoraIso: 'no-es-fecha', serviciosIds: [] },
      ctx('u1'),
    )) as { ok: boolean; motivo: string };
    expect(res.ok).toBe(false);
    expect(res.motivo).toBe('argumentos_invalidos');
    expect(create.calls).toBe(0);
  });

  it('con hora ocupada devuelve ok:false motivo hora_ocupada y no lanza', async () => {
    const create = new FakeCreateReservation(() => {
      throw new WorkerOverlapError();
    });
    const tool = new CreateReservationTool(create as never);
    const res = await tool.execute(
      { fechaHoraIso: '2026-08-20T14:00:00.000Z', serviciosIds: [UUID] },
      ctx('u1'),
    );
    expect(res).toMatchObject({ ok: false, motivo: 'hora_ocupada' });
  });

  it('en éxito devuelve ok:true con reservaId y estado', async () => {
    let received: unknown;
    const create = new FakeCreateReservation((cmd) => {
      received = cmd;
      return { id: 'r1', status: 'pendiente' };
    });
    const tool = new CreateReservationTool(create as never);
    const res = await tool.execute(
      { fechaHoraIso: '2026-08-20T14:00:00.000Z', serviciosIds: [UUID] },
      ctx('u1'),
    );
    expect(res).toEqual({ ok: true, reservaId: 'r1', estado: 'pendiente' });
    expect(received).toMatchObject({
      scheduledAt: '2026-08-20T14:00:00.000Z',
      serviceIds: [UUID],
      userId: 'u1',
    });
  });
});

describe('CreateReservationTool con verificación previa (plan 04, T5)', () => {
  const ISO_VIERNES_15 = '2026-10-02T20:00:00.000Z';

  class JuezDoble {
    peticiones: { state: Record<string, unknown> }[] = [];
    constructor(private readonly noul: number) {}
    async ask(request: { state: Record<string, unknown> }) {
      this.peticiones.push(request);
      return {
        ok: true as const,
        answers: { correspondencia: { type: 'noul', noul: this.noul } },
        model: 'jev-1.13.0',
        inputTokens: 300,
        ms: 240,
      };
    }
  }

  const catalogo = {
    findNamesByIds: async () => new Map([[UUID, 'Corte de dama']]),
  };

  const RECIENTES: AssistantContext['recientes'] = [
    { rol: 'clienta', texto: 'quiero un corte el viernes a las 3' },
    { rol: 'asistente', texto: 'Perfecto, tengo ese espacio.' },
  ];

  const conHistorial = (userId: string | null = 'u1'): AssistantContext => ({
    ...ctx(userId),
    canalConversacional: true,
    recientes: RECIENTES,
  });

  it('frena la reserva desviada y pide confirmación, sin crearla', async () => {
    // El veredicto negativo NO cancela ni bloquea en silencio: convierte la
    // duda en una pregunta, que es lo barato. Y viaja la propuesta para que el
    // modelo la lea tal cual en vez de inventarla.
    const create = new FakeCreateReservation(() => ({
      id: 'r1',
      status: 'pendiente',
    }));
    const tool = new CreateReservationTool(create as never, {
      judge: new JuezDoble(0.08) as never,
      modo: 'on',
      catalog: catalogo,
    });

    const res = (await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      conHistorial(),
    )) as { ok: boolean; motivo: string; propuesta: Record<string, unknown> };

    expect(res.ok).toBe(false);
    expect(res.motivo).toBe('confirmacion_requerida');
    expect(res.propuesta).toMatchObject({ servicios: ['Corte de dama'] });
    expect(create.calls).toBe(0);
  });

  it('deja escrita la pregunta que hay que hacerle a la clienta', async () => {
    // El bucle la usa si el turno se quedaría sin respuesta, para que la
    // clienta nunca lea una disculpa cuando lo que hacía falta era confirmar.
    // La escribe la herramienta porque es la única que conoce el dato.
    const tool = new CreateReservationTool(
      new FakeCreateReservation(() => ({
        id: 'r1',
        status: 'pendiente',
      })) as never,
      { judge: new JuezDoble(0.08) as never, modo: 'on', catalog: catalogo },
    );

    const res = (await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      conHistorial(),
    )) as { pregunta: string; instruccion: string };

    expect(res.pregunta).toContain('Corte de dama');
    expect(res.pregunta).toContain('15:00');
    expect(res.pregunta).toContain('viernes');
    expect(res.pregunta).toMatch(/\?$/);
  });

  it('la instrucción PROHÍBE volver a llamar en el mismo turno', async () => {
    // Si el modelo reintenta en el mismo turno, la caché de T1 le devuelve lo
    // mismo y el bucle se corta por falta de novedad. La instrucción tiene que
    // decirle que espere, no invitarle a reintentar.
    const tool = new CreateReservationTool(
      new FakeCreateReservation(() => ({
        id: 'r1',
        status: 'pendiente',
      })) as never,
      { judge: new JuezDoble(0.08) as never, modo: 'on', catalog: catalogo },
    );

    const res = (await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      conHistorial(),
    )) as { instruccion: string };

    expect(res.instruccion).toMatch(/no vuelvas a llamar/i);
    expect(res.instruccion).toMatch(/mismo turno/i);
  });

  it('deja crear la reserva que se corresponde con lo que pidió', async () => {
    const create = new FakeCreateReservation(() => ({
      id: 'r1',
      status: 'pendiente',
    }));
    const tool = new CreateReservationTool(create as never, {
      judge: new JuezDoble(0.95) as never,
      modo: 'on',
      catalog: catalogo,
    });

    const res = await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      conHistorial(),
    );

    expect(res).toMatchObject({ ok: true, reservaId: 'r1' });
    expect(create.calls).toBe(1);
  });

  it('en sombra pregunta pero crea igual', async () => {
    const create = new FakeCreateReservation(() => ({
      id: 'r1',
      status: 'pendiente',
    }));
    const juez = new JuezDoble(0.08);
    const tool = new CreateReservationTool(create as never, {
      judge: juez as never,
      modo: 'shadow',
      catalog: catalogo,
    });

    const res = await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      conHistorial(),
    );

    expect(res).toMatchObject({ ok: true });
    expect(juez.peticiones).toHaveLength(1);
  });

  it('no paga un juicio por lo que ya está rechazado: sin sesión ni con argumentos malos', async () => {
    // «Nunca se llama si el código puede decidir solo»: acertar no cuesta ni
    // una llamada.
    const juez = new JuezDoble(0.95);
    const create = new FakeCreateReservation(() => ({
      id: 'r1',
      status: 'pendiente',
    }));
    const tool = new CreateReservationTool(create as never, {
      judge: juez as never,
      modo: 'on',
      catalog: catalogo,
    });

    await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      conHistorial(null),
    );
    await tool.execute(
      { fechaHoraIso: 'no-es-fecha', serviciosIds: [] },
      conHistorial(),
    );

    expect(juez.peticiones).toHaveLength(0);
  });

  it('al proveedor le llegan los NOMBRES del catálogo y el día en palabras', async () => {
    const juez = new JuezDoble(0.95);
    const tool = new CreateReservationTool(
      new FakeCreateReservation(() => ({
        id: 'r1',
        status: 'pendiente',
      })) as never,
      { judge: juez as never, modo: 'on', catalog: catalogo },
    );

    await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      conHistorial(),
    );

    expect(juez.peticiones[0].state).toMatchObject({
      services: ['Corte de dama'],
      time: '15:00',
    });
    expect(String(juez.peticiones[0].state.date)).toContain('viernes');
  });

  it('sin historial no se pregunta: es el caso de MCP y del webhook', async () => {
    const juez = new JuezDoble(0.01);
    const create = new FakeCreateReservation(() => ({
      id: 'r1',
      status: 'pendiente',
    }));
    const tool = new CreateReservationTool(create as never, {
      judge: juez as never,
      modo: 'on',
      catalog: catalogo,
    });

    const res = await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      ctx('u1'),
    );

    expect(res).toMatchObject({ ok: true });
    expect(juez.peticiones).toHaveLength(0);
  });

  it('en off no consulta el catálogo: lo apagado no cuesta ni una consulta', async () => {
    // El nombre de los servicios solo hace falta para preguntar. Pedirlo con el
    // juicio apagado sería una consulta a la base en cada reserva a cambio de
    // nada.
    let consultas = 0;
    const tool = new CreateReservationTool(
      new FakeCreateReservation(() => ({
        id: 'r1',
        status: 'pendiente',
      })) as never,
      {
        judge: new JuezDoble(0.01) as never,
        modo: 'off',
        catalog: {
          findNamesByIds: async () => {
            consultas++;
            return new Map();
          },
        },
      },
    );

    const res = await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      conHistorial(),
    );

    expect(res).toMatchObject({ ok: true });
    expect(consultas).toBe(0);
  });

  it('sin historial tampoco consulta el catálogo', async () => {
    let consultas = 0;
    const tool = new CreateReservationTool(
      new FakeCreateReservation(() => ({
        id: 'r1',
        status: 'pendiente',
      })) as never,
      {
        judge: new JuezDoble(0.01) as never,
        modo: 'on',
        catalog: {
          findNamesByIds: async () => {
            consultas++;
            return new Map();
          },
        },
      },
    );

    await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      ctx('u1'),
    );

    expect(consultas).toBe(0);
  });

  it('si el catálogo falla, la reserva se crea como hoy', async () => {
    // Fail-open también aquí: una consulta de nombres que revienta no puede
    // costarle la reserva a la clienta.
    const create = new FakeCreateReservation(() => ({
      id: 'r1',
      status: 'pendiente',
    }));
    const tool = new CreateReservationTool(create as never, {
      judge: new JuezDoble(0.01) as never,
      modo: 'on',
      catalog: {
        findNamesByIds: async () => {
          throw new Error('la base no contesta');
        },
      },
    });

    const res = await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      conHistorial(),
    );

    expect(res).toMatchObject({ ok: true });
    expect(create.calls).toBe(1);
  });

  it('no verifica fuera del canal conversacional, aunque llegue historial', async () => {
    // La contención no puede depender de que `recientes` venga vacío por
    // casualidad: el día que otro adaptador primario rellene ese campo, la
    // salvaguarda del chat se le impondría también a él, contra la regla de que
    // el caso de uso de Reservas lo comparten cinco adaptadores.
    const juez = new JuezDoble(0.01);
    const create = new FakeCreateReservation(() => ({
      id: 'r1',
      status: 'pendiente',
    }));
    const tool = new CreateReservationTool(create as never, {
      judge: juez as never,
      modo: 'on',
      catalog: catalogo,
    });

    const res = await tool.execute(
      { fechaHoraIso: ISO_VIERNES_15, serviciosIds: [UUID] },
      { ...ctx('u1'), recientes: RECIENTES },
    );

    expect(res).toMatchObject({ ok: true });
    expect(juez.peticiones).toHaveLength(0);
  });

  it('una hora sin zona es hora del salón, no la del servidor (UTC)', async () => {
    let received: unknown;
    const create = new FakeCreateReservation((cmd) => {
      received = cmd;
      return { id: 'r1', status: 'pendiente' };
    });
    const tool = new CreateReservationTool(create as never);
    await tool.execute(
      { fechaHoraIso: '2026-08-20T09:00:00', serviciosIds: [UUID] },
      ctx('u1'),
    );
    expect(received).toMatchObject({
      scheduledAt: '2026-08-20T14:00:00.000Z',
    });
  });
});

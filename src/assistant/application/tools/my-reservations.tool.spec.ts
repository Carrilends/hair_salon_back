import { MyReservationsTool } from './my-reservations.tool';
import { AssistantContext } from './assistant-tool';

class FakeGetMine {
  calls: string[] = [];
  constructor(private readonly result: unknown[]) {}
  async execute(userId: string): Promise<unknown[]> {
    this.calls.push(userId);
    return this.result;
  }
}

function ctx(userId: string | null): AssistantContext {
  return { userId, now: new Date('2026-08-19T14:00:00Z'), isAdmin: false };
}

function reserva(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
    status: 'pendiente',
    totalDurationMinutes: 60,
    services: [{ name: 'Corte' }, { name: 'Peinado' }],
    workerPinned: false,
    ...over,
  };
}

describe('MyReservationsTool', () => {
  it('sin sesión devuelve sesion_requerida y NO llama al caso de uso', async () => {
    const getMine = new FakeGetMine([reserva()]);
    const tool = new MyReservationsTool(getMine as never);

    const res = await tool.execute({}, ctx(null));

    expect(res).toEqual({ ok: false, motivo: 'sesion_requerida' });
    expect(getMine.calls).toHaveLength(0);
  });

  it('usa el userId del CONTEXTO e ignora cualquier userId de los argumentos (inyección)', async () => {
    // La prueba de la inyección de instrucciones: un modelo "convencido" intenta
    // colar la identidad de otra persona por argumento. Debe ignorarse por completo.
    const getMine = new FakeGetMine([reserva()]);
    const tool = new MyReservationsTool(getMine as never);

    await tool.execute({ userId: 'otra-persona' }, ctx('cliente-real'));

    expect(getMine.calls).toEqual(['cliente-real']);
  });

  it('proyecta compacto (id, fecha, hora, estado, servicios, minutos) y limita a 10', async () => {
    const muchas = Array.from({ length: 12 }, (_, i) =>
      reserva({ id: `r${i}` }),
    );
    const getMine = new FakeGetMine(muchas);
    const tool = new MyReservationsTool(getMine as never);

    const res = (await tool.execute({}, ctx('u1'))) as Array<
      Record<string, unknown>
    >;

    expect(res).toHaveLength(10);
    // `estilistaElegida` se suma a la proyección. Es la condición del aviso
    // previo: a quien eligió estilista no se la cambian nunca al mover la cita,
    // así que avisarla sería preocuparla por algo que no puede pasarle. Sigue
    // siendo un sí/no —el chat no nombra estilistas—.
    expect(res[0]).toEqual({
      id: 'r0',
      fecha: 'jueves, 20 de agosto de 2026',
      hora: '09:00',
      estado: 'pendiente',
      servicios: ['Corte', 'Peinado'],
      minutos: 60,
      estilistaElegida: false,
    });
  });

  it.each(['web', 'mcp'] as const)(
    'en %s entrega fecha y hora del salón, no el instante en UTC',
    async (canal) => {
      const getMine = new FakeGetMine([
        reserva({ scheduledAt: new Date('2026-11-06T16:00:00Z') }),
      ]);
      const tool = new MyReservationsTool(getMine as never);

      const res = (await tool.execute({}, {
        ...ctx('u1'),
        canal,
      } as AssistantContext)) as Array<Record<string, unknown>>;

      expect(res[0]).toMatchObject({
        hora: '11:00',
        fecha: 'viernes, 6 de noviembre de 2026',
      });
      expect(res[0]).not.toHaveProperty('cuando');
    },
  );

  it('proyecta estilistaElegida en true cuando la clienta la eligió', async () => {
    const getMine = new FakeGetMine([reserva({ workerPinned: true })]);
    const tool = new MyReservationsTool(getMine as never);

    const res = (await tool.execute({}, ctx('u1'))) as Array<
      Record<string, unknown>
    >;

    expect(res[0].estilistaElegida).toBe(true);
  });

  it('la proyección sigue sin llevar NINGÚN nombre de estilista', async () => {
    // Límite: RF57/RF58 no dan estilistas al chat. `estilistaElegida` es un
    // sí/no sobre el origen de la asignación, no una identidad.
    const getMine = new FakeGetMine([reserva({ workerPinned: true })]);
    const tool = new MyReservationsTool(getMine as never);

    const res = (await tool.execute({}, ctx('u1'))) as Array<
      Record<string, unknown>
    >;

    expect(Object.keys(res[0]).sort()).toEqual([
      'estado',
      'estilistaElegida',
      'fecha',
      'hora',
      'id',
      'minutos',
      'servicios',
    ]);
  });
});

describe('MyReservationsTool · presentar (TC-RF54-01)', () => {
  // 12 citas futuras, desordenadas, de la 1 (más próxima) a la 12.
  const doce = Array.from({ length: 12 }, (_, i) =>
    reserva({
      id: `r${i + 1}`,
      scheduledAt: new Date(Date.UTC(2026, 8, 1 + i, 15, 0)),
      worker: { name: 'Monica' },
    }),
  ).reverse();

  it('lista las diez más próximas, de la más cercana a la más lejana', async () => {
    const tool = new MyReservationsTool(new FakeGetMine(doce) as never);

    const res = (await tool.execute({}, ctx('u1'))) as Array<{ id: string }>;

    expect(res.map((r) => r.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `r${i + 1}`),
    );
  });

  it('presenta una línea por cita y avisa de que hay más', async () => {
    const tool = new MyReservationsTool(new FakeGetMine(doce) as never);
    const p = await tool.presentar(await tool.execute({}, ctx('u1')));

    if (p?.tipo !== 'texto') throw new Error('no es texto');
    const citas = p.lineas.filter((l) => l.includes(' · '));
    expect(citas).toHaveLength(10);
    expect(citas[0]).toBe(
      '1. martes, 1 de septiembre de 2026 · 10:00 · Corte, Peinado · con Monica',
    );
    expect(p.lineas[p.lineas.length - 1]).toBe(
      'Tienes 2 reservas más: pídeme un día concreto.',
    );
  });

  it('con diez o menos no dice que hay más, y sin estilista no inventa «con»', async () => {
    const tool = new MyReservationsTool(
      new FakeGetMine([
        reserva({ scheduledAt: new Date('2026-08-20T14:00:00Z') }),
      ]) as never,
    );
    const p = await tool.presentar(await tool.execute({}, ctx('u1')));

    if (p?.tipo !== 'texto') throw new Error('no es texto');
    expect(p.lineas.join('\n')).not.toMatch(/más|con /);
  });

  it('no cuenta las canceladas ni las pasadas, y no presenta errores ni vacíos', async () => {
    const tool = new MyReservationsTool(
      new FakeGetMine([
        reserva({ status: 'cancelada' }),
        reserva({ scheduledAt: new Date('2026-08-01T14:00:00Z') }),
      ]) as never,
    );
    expect(await tool.presentar(await tool.execute({}, ctx('u1')))).toBeNull();
    expect(
      await tool.presentar({ ok: false, motivo: 'sesion_requerida' }),
    ).toBeNull();
  });

  it('no filtra teléfonos ni correos', async () => {
    const tool = new MyReservationsTool(
      new FakeGetMine([
        reserva({
          contact: { phone: '3001112233', email: 'a@b.co' },
          worker: { name: 'Monica' },
        }),
      ]) as never,
    );
    const p = await tool.presentar(await tool.execute({}, ctx('u1')));
    expect(JSON.stringify(p)).not.toMatch(/3001112233|a@b\.co/);
  });
});

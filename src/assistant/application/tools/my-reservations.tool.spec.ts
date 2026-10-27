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

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

  it('proyecta compacto (id, cuando, estado, servicios, minutos) y limita a 10', async () => {
    const muchas = Array.from({ length: 12 }, (_, i) =>
      reserva({ id: `r${i}` }),
    );
    const getMine = new FakeGetMine(muchas);
    const tool = new MyReservationsTool(getMine as never);

    const res = (await tool.execute({}, ctx('u1'))) as Array<
      Record<string, unknown>
    >;

    expect(res).toHaveLength(10);
    expect(res[0]).toEqual({
      id: 'r0',
      cuando: new Date('2026-08-20T14:00:00.000Z'),
      estado: 'pendiente',
      servicios: ['Corte', 'Peinado'],
      minutos: 60,
    });
  });
});

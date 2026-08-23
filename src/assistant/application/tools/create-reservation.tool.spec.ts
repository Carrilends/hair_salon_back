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

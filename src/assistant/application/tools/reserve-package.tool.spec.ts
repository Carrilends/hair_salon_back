import { ReservePackageTool } from './reserve-package.tool';
import { AssistantContext } from './assistant-tool';
import { OutOfBusinessHoursError } from 'src/reservations/domain/errors';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

class FakeCreate {
  calls: unknown[] = [];
  constructor(private readonly behavior: (cmd: unknown) => unknown) {}
  async execute(cmd: unknown): Promise<unknown> {
    this.calls.push(cmd);
    return this.behavior(cmd);
  }
}

function ctx(userId: string | null): AssistantContext {
  return { userId, now: new Date('2026-08-19T14:00:00Z'), isAdmin: false };
}

describe('ReservePackageTool', () => {
  it('sin sesión devuelve sesion_requerida y NO llama al caso de uso', async () => {
    const create = new FakeCreate(() => {
      throw new Error('no debería llamarse');
    });
    const tool = new ReservePackageTool(create as never);

    const res = await tool.execute(
      { serviciosIds: [UUID_A], fechaHoraIso: '2026-08-20T14:00:00.000Z' },
      ctx(null),
    );

    expect(res).toEqual({ ok: false, motivo: 'sesion_requerida' });
    expect(create.calls).toHaveLength(0);
  });

  it('sin serviciosIds o sin fecha devuelve argumentos_invalidos', async () => {
    const create = new FakeCreate(() => ({ id: 'x', status: 'pendiente' }));
    const tool = new ReservePackageTool(create as never);

    const res = await tool.execute(
      { serviciosIds: [], fechaHoraIso: '2026-08-20T14:00:00.000Z' },
      ctx('u1'),
    );

    expect(res).toEqual({ ok: false, motivo: 'argumentos_invalidos' });
    expect(create.calls).toHaveLength(0);
  });

  it('rechaza serviciosIds no-UUID como argumentos_invalidos sin llamar al caso de uso', async () => {
    const create = new FakeCreate(() => ({ id: 'x', status: 'pendiente' }));
    const tool = new ReservePackageTool(create as never);

    const res = await tool.execute(
      {
        serviciosIds: ['no-es-uuid'],
        fechaHoraIso: '2026-08-20T14:00:00.000Z',
      },
      ctx('u1'),
    );

    expect(res).toEqual({ ok: false, motivo: 'argumentos_invalidos' });
    expect(create.calls).toHaveLength(0);
  });

  it('rechaza una fecha no-ISO como argumentos_invalidos sin llamar al caso de uso', async () => {
    const create = new FakeCreate(() => ({ id: 'x', status: 'pendiente' }));
    const tool = new ReservePackageTool(create as never);

    const res = await tool.execute(
      { serviciosIds: [UUID_A], fechaHoraIso: 'mañana' },
      ctx('u1'),
    );

    expect(res).toEqual({ ok: false, motivo: 'argumentos_invalidos' });
    expect(create.calls).toHaveLength(0);
  });

  it('reserva el paquete como UNA reserva con varias líneas', async () => {
    const create = new FakeCreate(() => ({ id: 'res1', status: 'pendiente' }));
    const tool = new ReservePackageTool(create as never);

    const res = await tool.execute(
      {
        serviciosIds: [UUID_A, UUID_B],
        fechaHoraIso: '2026-08-20T14:00:00.000Z',
      },
      ctx('u1'),
    );

    expect(res).toEqual({ ok: true, reservaId: 'res1', estado: 'pendiente' });
    expect(create.calls[0]).toMatchObject({
      scheduledAt: '2026-08-20T14:00:00.000Z',
      serviceIds: [UUID_A, UUID_B],
      userId: 'u1',
    });
  });

  it('si el paquete no cabe en el horario, vuelve el motivo del dominio sin lanzar', async () => {
    const create = new FakeCreate(() => {
      throw new OutOfBusinessHoursError();
    });
    const tool = new ReservePackageTool(create as never);

    const res = await tool.execute(
      {
        serviciosIds: [UUID_A, UUID_B],
        fechaHoraIso: '2026-08-20T21:00:00.000Z',
      },
      ctx('u1'),
    );

    expect(res).toEqual({ ok: false, motivo: 'fuera_de_horario' });
  });

  it('una hora sin zona es hora del salón, no la del servidor (UTC)', async () => {
    const create = new FakeCreate(() => ({ id: 'res1', status: 'pendiente' }));
    const tool = new ReservePackageTool(create as never);
    await tool.execute(
      { serviciosIds: [UUID_A], fechaHoraIso: '2026-08-20T09:00' },
      ctx('u1'),
    );
    expect(create.calls[0]).toMatchObject({
      scheduledAt: '2026-08-20T14:00:00.000Z',
    });
  });
});

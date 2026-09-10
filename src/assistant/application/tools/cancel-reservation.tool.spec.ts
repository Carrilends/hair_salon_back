import { ForbiddenException } from '@nestjs/common';
import { CancelReservationTool } from './cancel-reservation.tool';
import { AssistantContext } from './assistant-tool';
import {
  CancellationTooLateError,
  InvalidStatusTransitionError,
  ReservationNotFoundError,
} from 'src/reservations/domain/errors';

interface Actor {
  userId: string | null;
  isAdmin: boolean;
}

class FakeCancel {
  calls: Array<{ id: string; actor: Actor }> = [];
  constructor(
    private readonly behavior: (id: string, actor: Actor) => unknown,
  ) {}
  async execute(id: string, actor: Actor): Promise<unknown> {
    this.calls.push({ id, actor });
    return this.behavior(id, actor);
  }
}

function ctx(userId: string | null, isAdmin = false): AssistantContext {
  return { userId, now: new Date('2026-08-19T14:00:00Z'), isAdmin };
}

describe('CancelReservationTool', () => {
  it('sin sesión devuelve sesion_requerida y NO llama al caso de uso', async () => {
    const cancel = new FakeCancel(() => {
      throw new Error('no debería llamarse');
    });
    const tool = new CancelReservationTool(cancel as never);

    const res = await tool.execute({ reservaId: 'r1' }, ctx(null));

    expect(res).toEqual({ ok: false, motivo: 'sesion_requerida' });
    expect(cancel.calls).toHaveLength(0);
  });

  it('sin reservaId válido devuelve argumentos_invalidos sin llamar al caso de uso', async () => {
    const cancel = new FakeCancel(() => ({ status: 'cancelada' }));
    const tool = new CancelReservationTool(cancel as never);

    const res = await tool.execute({}, ctx('u1'));

    expect(res).toEqual({ ok: false, motivo: 'argumentos_invalidos' });
    expect(cancel.calls).toHaveLength(0);
  });

  it('pasa la identidad y el rol del CONTEXTO, nunca de los argumentos', async () => {
    // Inyección: el modelo intenta pasar userId/isAdmin por argumento; se ignoran.
    const cancel = new FakeCancel(() => ({ status: 'cancelada' }));
    const tool = new CancelReservationTool(cancel as never);

    await tool.execute(
      { reservaId: 'r1', userId: 'otra-persona', isAdmin: true },
      ctx('cliente-real', false),
    );

    expect(cancel.calls[0]).toEqual({
      id: 'r1',
      actor: { kind: 'user', userId: 'cliente-real' },
    });
  });

  it('reserva ajena (ForbiddenException) vuelve como ok:false motivo no_es_tu_reserva', async () => {
    const cancel = new FakeCancel(() => {
      throw new ForbiddenException(
        'No puede cancelar una reserva de otro usuario',
      );
    });
    const tool = new CancelReservationTool(cancel as never);

    const res = await tool.execute({ reservaId: 'r1' }, ctx('u1'));

    expect(res).toEqual({ ok: false, motivo: 'no_es_tu_reserva' });
  });

  it('pasada la hora y sin admin devuelve fuera_de_plazo (no cancela)', async () => {
    const cancel = new FakeCancel(() => {
      throw new CancellationTooLateError();
    });
    const tool = new CancelReservationTool(cancel as never);

    const res = await tool.execute({ reservaId: 'r1' }, ctx('u1', false));

    expect(res).toEqual({ ok: false, motivo: 'fuera_de_plazo' });
  });

  it('con rol admin la cancelación procede', async () => {
    const cancel = new FakeCancel(() => ({ status: 'cancelada' }));
    const tool = new CancelReservationTool(cancel as never);

    const res = await tool.execute({ reservaId: 'r1' }, ctx('admin-1', true));

    expect(res).toEqual({ ok: true, estado: 'cancelada' });
    expect(cancel.calls[0].actor).toEqual({ kind: 'admin' });
  });

  it('reserva inexistente vuelve como reserva_no_encontrada', async () => {
    const cancel = new FakeCancel(() => {
      throw new ReservationNotFoundError('r1');
    });
    const tool = new CancelReservationTool(cancel as never);

    const res = await tool.execute({ reservaId: 'r1' }, ctx('u1'));

    expect(res).toEqual({ ok: false, motivo: 'reserva_no_encontrada' });
  });

  it('estado terminal (ya cancelada/cumplida) vuelve como estado_no_cancelable', async () => {
    const cancel = new FakeCancel(() => {
      throw new InvalidStatusTransitionError('cancelada', 'cancelada');
    });
    const tool = new CancelReservationTool(cancel as never);

    const res = await tool.execute({ reservaId: 'r1' }, ctx('u1'));

    expect(res).toEqual({ ok: false, motivo: 'estado_no_cancelable' });
  });
});

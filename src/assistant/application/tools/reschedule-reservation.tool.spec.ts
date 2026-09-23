import {
  RescheduleReservationTool,
  mapRescheduleErrorToReason,
} from './reschedule-reservation.tool';
import { AssistantContext } from './assistant-tool';
import {
  OutOfBusinessHoursError,
  RescheduleTooLateError,
  ReservationInThePastError,
  ReservationNotFoundError,
  ReservationNotReschedulableError,
  ReservationOwnershipError,
  WorkerOverlapError,
  ChosenWorkerBusyError,
} from 'src/reservations/domain/errors';

class FakeReschedule {
  calls: { id: string; scheduledAt: string; actor: unknown }[] = [];
  constructor(private readonly behaviour: () => { status: string }) {}
  async execute(id: string, scheduledAt: string, actor: unknown) {
    this.calls.push({ id, scheduledAt, actor });
    return this.behaviour();
  }
}

function ctx(userId: string | null, isAdmin = false): AssistantContext {
  return { userId, isAdmin, now: new Date('2026-04-20T12:00:00.000Z') };
}

describe('RescheduleReservationTool', () => {
  it('sin sesión no reprograma nada', async () => {
    const uc = new FakeReschedule(() => ({ status: 'pendiente' }));
    const tool = new RescheduleReservationTool(uc as never);

    const res = await tool.execute(
      { reservaId: 'r1', nuevaFecha: '2026-04-21T16:00:00.000Z' },
      ctx(null),
    );

    expect(res).toEqual({ ok: false, motivo: 'sesion_requerida' });
    expect(uc.calls).toHaveLength(0);
  });

  it('valida los argumentos antes de llamar al caso de uso', async () => {
    const uc = new FakeReschedule(() => ({ status: 'pendiente' }));
    const tool = new RescheduleReservationTool(uc as never);

    expect(await tool.execute({ reservaId: 'r1' }, ctx('u1'))).toEqual({
      ok: false,
      motivo: 'argumentos_invalidos',
    });
    expect(
      await tool.execute({ nuevaFecha: '2026-04-21T16:00:00.000Z' }, ctx('u1')),
    ).toEqual({ ok: false, motivo: 'argumentos_invalidos' });
    expect(uc.calls).toHaveLength(0);
  });

  it('la identidad sale del CONTEXTO, nunca de los argumentos', async () => {
    // Inyección: el modelo intenta colar userId/isAdmin por argumento. Se ignoran
    // porque no existen en el esquema y porque la herramienta no los lee.
    const uc = new FakeReschedule(() => ({ status: 'pendiente' }));
    const tool = new RescheduleReservationTool(uc as never);

    await tool.execute(
      {
        reservaId: 'r1',
        nuevaFecha: '2026-04-21T16:00:00.000Z',
        userId: 'otra-persona',
        isAdmin: true,
      },
      ctx('cliente-real', false),
    );

    expect(uc.calls[0]).toEqual({
      id: 'r1',
      scheduledAt: '2026-04-21T16:00:00.000Z',
      actor: { kind: 'user', userId: 'cliente-real' },
    });
  });

  it('con rol admin fabrica el actor de administración', async () => {
    const uc = new FakeReschedule(() => ({ status: 'confirmada' }));
    const tool = new RescheduleReservationTool(uc as never);

    const res = await tool.execute(
      { reservaId: 'r1', nuevaFecha: '2026-04-21T16:00:00.000Z' },
      ctx('admin-1', true),
    );

    expect(res).toEqual({ ok: true, estado: 'confirmada' });
    expect(uc.calls[0].actor).toEqual({ kind: 'admin' });
  });

  it('el esquema no publica ningún campo de identidad', () => {
    const uc = new FakeReschedule(() => ({ status: 'pendiente' }));
    const tool = new RescheduleReservationTool(uc as never);
    const props = tool.definition.parameters.properties as Record<
      string,
      unknown
    >;

    expect(Object.keys(props).sort()).toEqual(['nuevaFecha', 'reservaId']);
    expect(tool.definition.parameters.additionalProperties).toBe(false);
  });

  /**
   * La descripción es **contrato con el modelo**: lo que diga aquí es lo que el
   * asistente le promete a la clienta. Prometía «conservando sus servicios y su
   * estilista», y eso solo es cierto ya para las reservas cuya estilista eligió
   * la clienta; en las demás, mover la cita puede reasignarla. Una mentira aquí
   * se convierte en una mentira dicha a la clienta.
   */
  it('no promete que la estilista se conserve siempre', () => {
    const uc = { execute: async () => ({ status: 'pendiente' }) };
    const tool = new RescheduleReservationTool(uc as never);

    expect(tool.definition.description).not.toMatch(/y su estilista/);
    // Y sí dice de qué depende, para que el modelo pueda explicarlo.
    expect(tool.definition.description).toMatch(/estilista/);
  });
});

describe('mapRescheduleErrorToReason', () => {
  it.each([
    [new ReservationOwnershipError(), 'no_es_tu_reserva'],
    [new ReservationNotFoundError('r1'), 'reserva_no_encontrada'],
    [new RescheduleTooLateError(), 'fuera_de_plazo'],
    [new ReservationNotReschedulableError('cancelada'), 'estado_no_movible'],
    [new WorkerOverlapError(), 'hora_ocupada'],
    [new ChosenWorkerBusyError(), 'estilista_ocupada'],
    [new OutOfBusinessHoursError(), 'fuera_de_horario'],
    [new ReservationInThePastError(), 'fecha_pasada'],
    [new Error('otra cosa'), 'error_desconocido'],
  ])('traduce %s a un motivo legible', (error, motivo) => {
    expect(mapRescheduleErrorToReason(error)).toBe(motivo);
  });

  /**
   * `ChosenWorkerBusyError` hereda de `WorkerOverlapError`, así que el orden de
   * los `instanceof` **es** la lógica: si el genérico va primero se come al
   * específico y el modelo vuelve a recibir un motivo que no distingue «tu
   * estilista no puede» de «el salón está lleno». Esto lo fija.
   */
  it('el motivo específico gana al genérico del que hereda', () => {
    expect(mapRescheduleErrorToReason(new ChosenWorkerBusyError())).not.toBe(
      'hora_ocupada',
    );
  });
});

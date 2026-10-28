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

/**
 * El caso de uso devuelve la **operación**, no la reserva: `workerChanged` es un
 * hecho del movimiento («cambió la persona que te atiende»), no un campo de la
 * reserva guardada. El doble refleja esa forma.
 */
class FakeReschedule {
  calls: { id: string; scheduledAt: string; actor: unknown }[] = [];
  constructor(
    private readonly behaviour: () => {
      status: string;
      workerChanged?: boolean;
    },
  ) {}
  async execute(id: string, scheduledAt: string, actor: unknown) {
    this.calls.push({ id, scheduledAt, actor });
    const { status, workerChanged } = this.behaviour();
    return {
      reservation: { status },
      workerChanged: workerChanged ?? false,
    };
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

    // La respuesta lleva además `estilistaCambio`: el modelo no puede inferirlo
    // de ningún otro sitio —`misReservas` no proyecta estilista— y sin él no
    // podría contarle a la clienta que la reasignaron.
    expect(res).toEqual({
      ok: true,
      estado: 'confirmada',
      estilistaCambio: false,
    });
    expect(uc.calls[0].actor).toEqual({ kind: 'admin' });
  });

  it('el esquema no publica ningún campo de identidad', () => {
    const uc = new FakeReschedule(() => ({ status: 'pendiente' }));
    const tool = new RescheduleReservationTool(uc as never);
    const props = tool.definition.parameters.properties as Record<
      string,
      unknown
    >;

    expect(Object.keys(props).sort()).toEqual([
      'fechaDeLaCita',
      'horaDeLaCita',
      'nuevaFecha',
      'reservaId',
    ]);
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
    const uc = new FakeReschedule(() => ({ status: 'pendiente' }));
    const tool = new RescheduleReservationTool(uc as never);

    expect(tool.definition.description).not.toMatch(/y su estilista/);
    // Y sí dice de qué depende, para que el modelo pueda explicarlo.
    expect(tool.definition.description).toMatch(/estilista/);
  });
});

/**
 * El aviso de que cambió la estilista, en el chat.
 *
 * **Después**, y solo si de verdad cambió. El modelo no tiene forma de saberlo:
 * `misReservas` no proyecta estilista (RF57/RF58 no le dan esa capacidad), así
 * que si la herramienta no lo dice, nadie se lo dice a la clienta.
 *
 * Al modelo le llega **solo un booleano**, nunca un nombre: así no puede
 * repetirlo mal ni usarlo fuera de lugar. El nombre de la nueva estilista lo
 * pone `presentar` aparte (TC-RF54-01), en una frase fija que la clienta lee
 * tal cual; MCP, que no presenta, se queda con el booleano.
 */
describe('RescheduleReservationTool · aviso de cambio de estilista', () => {
  it('dice que cambió cuando el caso de uso reasignó', async () => {
    const uc = new FakeReschedule(() => ({
      status: 'pendiente',
      workerChanged: true,
    }));
    const tool = new RescheduleReservationTool(uc as never);

    const res = await tool.execute(
      { reservaId: 'r1', nuevaFecha: '2026-04-21T16:00:00.000Z' },
      ctx('u1'),
    );

    expect(res).toEqual({
      ok: true,
      estado: 'pendiente',
      estilistaCambio: true,
    });
  });

  it('el aviso es un sí/no: la respuesta no lleva NINGÚN nombre de estilista', async () => {
    // Límite duro: el resultado que ve el modelo no lleva nombres; el de la
    // nueva estilista viaja aparte, en la presentación.
    const uc = new FakeReschedule(() => ({
      status: 'pendiente',
      workerChanged: true,
    }));
    const tool = new RescheduleReservationTool(uc as never);

    const res = (await tool.execute(
      { reservaId: 'r1', nuevaFecha: '2026-04-21T16:00:00.000Z' },
      ctx('u1'),
    )) as Record<string, unknown>;

    expect(Object.keys(res).sort()).toEqual([
      'estado',
      'estilistaCambio',
      'ok',
    ]);
    expect(typeof res.estilistaCambio).toBe('boolean');
  });

  /**
   * La descripción es el contrato con el modelo: si no le dice que avise antes,
   * la clienta se entera cuando ya está hecho. El aviso previo solo tiene
   * sentido para las reservas sin estilista elegida —a quien la eligió no puede
   * pasarle—, y esa condición se la da `misReservas` con `estilistaElegida`.
   */
  it('la descripción le pide avisar ANTES, y solo cuando puede pasar', () => {
    const uc = new FakeReschedule(() => ({ status: 'pendiente' }));
    const tool = new RescheduleReservationTool(uc as never);

    expect(tool.definition.description).toMatch(/estilistaElegida/);
    expect(tool.definition.description).toMatch(/antes/i);
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

  it('una hora nueva sin zona es hora del salón, no la del servidor (UTC)', async () => {
    const uc = new FakeReschedule(() => ({ status: 'pendiente' }));
    const tool = new RescheduleReservationTool(uc as never);
    await tool.execute(
      { reservaId: 'r1', nuevaFecha: '2026-04-21T11:00:00' },
      ctx('u1'),
    );
    expect(uc.calls[0].scheduledAt).toBe('2026-04-21T16:00:00.000Z');
  });
});

describe('RescheduleReservationTool · confirmación escrita por el sistema (TC-RF54-01)', () => {
  // 16:00Z = martes 21 de abril, 11:00 en Bogotá.
  const QUEDO = 'Tu cita quedó el martes, 21 de abril de 2026 a las 11:00';
  const args = { reservaId: 'r1', nuevaFecha: '2026-04-21T16:00:00.000Z' };
  const montar = (workerChanged: boolean) => {
    const uc = {
      execute: async () => ({
        reservation: { status: 'pendiente', workerId: 'w-2' },
        workerChanged,
      }),
    };
    return new RescheduleReservationTool(uc as never, async (id: string) =>
      id === 'w-2' ? 'Alejandra' : null,
    );
  };

  it('si cambió la estilista, la confirmación dice la hora nueva y quién la atenderá', async () => {
    const tool = montar(true);
    const res = await tool.execute(args, ctx('u1'));
    const p = await tool.presentar(res);

    if (p?.tipo !== 'texto') throw new Error('no es texto');
    expect(p.lineas).toEqual([
      `${QUEDO}; te atenderá Alejandra, otra estilista.`,
    ]);
    expect(p.clase).toBe('escritura');
    // lo que se guarda en el historial no lleva el nombre de la estilista
    expect(p.enElHistorial).toBe(`${QUEDO}; te atenderá otra estilista.`);
    // el resultado para el modelo sigue sin nombres
    expect(JSON.stringify(res)).not.toMatch(/Alejandra/);
  });

  it('si no cambió, la confirmación dice la hora nueva y nada de otra estilista', async () => {
    const tool = montar(false);
    const p = await tool.presentar(await tool.execute(args, ctx('u1')));
    if (p?.tipo !== 'texto') throw new Error('no es texto');
    expect(p.lineas).toEqual([`${QUEDO}.`]);
    expect(p.lineas.join(' ')).not.toMatch(/estilista/);
  });

  it('la hora de la confirmación es la que devolvió el caso de uso', async () => {
    const uc = {
      execute: async () => ({
        reservation: {
          status: 'pendiente',
          workerId: 'w-1',
          scheduledAt: new Date('2026-04-21T17:30:00.000Z'),
        },
        workerChanged: false,
      }),
    };
    const tool = new RescheduleReservationTool(uc as never);
    const p = await tool.presentar(await tool.execute(args, ctx('u1')));
    if (p?.tipo !== 'texto') throw new Error('no es texto');
    expect(p.lineas).toEqual([
      'Tu cita quedó el martes, 21 de abril de 2026 a las 12:30.',
    ]);
  });

  it('sin nombre disponible, la frase sigue siendo cierta', async () => {
    const uc = {
      execute: async () => ({
        reservation: { status: 'pendiente', workerId: 'w-9' },
        workerChanged: true,
      }),
    };
    const tool = new RescheduleReservationTool(uc as never, async () => {
      throw new Error('x');
    });
    const p = await tool.presentar(await tool.execute(args, ctx('u1')));
    if (p?.tipo !== 'texto') throw new Error('no es texto');
    expect(p.lineas).toEqual([`${QUEDO}; te atenderá otra estilista.`]);
  });

  it('un error no se presenta', async () => {
    const tool = montar(true);
    expect(
      await tool.presentar({ ok: false, motivo: 'hora_ocupada' }),
    ).toBeNull();
  });
});

describe('RescheduleReservationTool · descripción verdadera en todos los canales', () => {
  const d = new RescheduleReservationTool({
    execute: async () => ({}),
  } as never).definition.description;
  it('no promete una frase aparte que MCP no recibe', () => {
    expect(d).not.toMatch(/mostrará aparte/);
    expect(d).toMatch(/si el canal/i);
  });
  it('no obliga a callar el aviso previo', () => {
    expect(d).toMatch(/Antes de llamarla/);
  });
});

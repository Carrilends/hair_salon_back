import { MarkAbsenceUseCase } from './mark-absence.use-case';
import {
  AbsenceOverlapError,
  InvalidAbsenceError,
  WorkerOverlapError,
} from '../../domain/errors';
import { Reservation } from '../../domain/reservation';
import { NOW, cita, plan, repoAusencias } from './absences-helpers-spec';

function montar(
  opts: {
    /** Falla todo guardado de esta cita. */
    falla?: string;
    /** Falla solo el guardado que la pasa a otra estilista. */
    fallaReasignar?: string;
    avisoCae?: boolean;
    planFalla?: boolean;
  } = {},
) {
  const absences = repoAusencias();
  const citas = new Map([
    ['a', cita('a', '10:00')],
    ['b', cita('b', '11:00')],
  ]);
  const reservas = {
    findById: jest.fn(async (id: string) => citas.get(id) ?? null),
    save: jest.fn(async (r: any) => {
      if (r.id === opts.falla) throw new Error('exclusion');
      if (
        r.id === opts.fallaReasignar &&
        r.workerId === 'libre' &&
        r.status !== 'cancelada'
      ) {
        throw new Error('exclusion');
      }
      return r;
    }),
  };
  const ventanas = new Map(
    [...citas].map(([id, c]) => [id, [c.scheduledAt, c.endedAt]] as const),
  );
  const impacto = (id: string, outcome: 'reasignada' | 'cancelada') => ({
    reservationId: id,
    scheduledAt: ventanas.get(id)![0],
    endedAt: ventanas.get(id)![1],
    customerName: 'Clienta Prueba',
    customerPhone: null,
    services: ['Corte'],
    outcome,
    ...(outcome === 'reasignada'
      ? { newWorkerId: 'libre', newWorkerName: 'Estilista B' }
      : {}),
  });
  const planner = {
    planear: jest.fn(async () =>
      plan([impacto('a', 'reasignada'), impacto('b', 'cancelada')]),
    ),
  };
  // En vivo: 'a' tiene una libre; 'b' no.
  const assigner = {
    elegir: jest.fn(async (_s: Date, _e: Date, _tz: string, o: any) => {
      if (o.excludeReservationId === 'b') throw new WorkerOverlapError();
      return 'libre';
    }),
  };
  const workers = {
    findWorker: jest.fn(async (id: string) => ({
      id,
      name: 'Estilista B',
      isDefault: false,
    })),
  };
  const notifier = {
    reservationCancelled: jest.fn(async () => {
      if (opts.avisoCae) throw new Error('canal caído');
    }),
    reservationRescheduled: jest.fn(async () => {
      if (opts.avisoCae) throw new Error('canal caído');
    }),
  };
  const uc = new MarkAbsenceUseCase(
    absences as never,
    reservas as never,
    planner as never,
    notifier as never,
    { now: () => NOW } as never,
    assigner as never,
    workers as never,
  );
  return { uc, absences, reservas, planner, notifier, citas, assigner };
}

const CMD = { workerId: 'ausente', dateYmd: '2030-03-12' };

describe('MarkAbsenceUseCase', () => {
  it('guarda la ausencia, reasigna y cancela según el plan y emite un evento por cita con absence', async () => {
    const { uc, absences, notifier, citas } = montar();

    const r = await uc.execute(CMD);

    expect(absences.save).toHaveBeenCalledTimes(1);
    expect(r.absenceId).toBe('abs-1');
    expect(r.sinResolver).toEqual([]);
    expect(citas.get('a')!.workerId).toBe('libre');
    expect(citas.get('b')!.status).toBe('cancelada');
    expect(notifier.reservationRescheduled).toHaveBeenCalledTimes(1);
    expect(notifier.reservationRescheduled).toHaveBeenCalledWith(
      citas.get('a'),
      expect.objectContaining({
        byAdmin: true,
        workerChanged: true,
        previousScheduledAt: citas.get('a')!.scheduledAt,
        absence: { absentWorkerName: 'Estilista A' },
      }),
    );
    expect(notifier.reservationCancelled).toHaveBeenCalledWith(citas.get('b'), {
      byAdmin: true,
      absence: { absentWorkerName: 'Estilista A' },
    });
  });

  it('guarda la ausencia antes de volver a planear', async () => {
    const { uc, absences, planner } = montar();
    const orden: string[] = [];
    absences.save.mockImplementationOnce(async (a: any) => {
      orden.push('save');
      return { ...a, id: 'abs-1' };
    });
    planner.planear.mockImplementation(async () => {
      orden.push('plan');
      return plan([]);
    });

    await uc.execute(CMD);

    expect(orden).toEqual(['plan', 'save', 'plan']); // validar, guardar, re-planear
  });

  it('mark dos veces la misma franja → la segunda AbsenceOverlapError y ningún evento nuevo', async () => {
    const { uc, notifier } = montar();
    await uc.execute(CMD);
    const antes =
      notifier.reservationCancelled.mock.calls.length +
      notifier.reservationRescheduled.mock.calls.length;

    await expect(uc.execute(CMD)).rejects.toThrow(AbsenceOverlapError);

    expect(
      notifier.reservationCancelled.mock.calls.length +
        notifier.reservationRescheduled.mock.calls.length,
    ).toBe(antes);
  });

  it('mark con un fallo al guardar una cita → la cita queda en sinResolver y las demás se aplican', async () => {
    const { uc, notifier, citas } = montar({ falla: 'a' });

    const r = await uc.execute(CMD);

    // Ni mover ni cancelar 'a' se pudo guardar.
    expect(r.sinResolver).toEqual(['a']);
    expect(r.impacts.map((i) => i.reservationId)).toEqual(['b']);
    expect(citas.get('b')!.status).toBe('cancelada');
    expect(notifier.reservationCancelled).toHaveBeenCalledTimes(1);
    expect(notifier.reservationRescheduled).not.toHaveBeenCalled();
  });

  it('si falla guardar la reasignación, la cita se cancela y se avisa con absence', async () => {
    const { uc, notifier, citas } = montar({ fallaReasignar: 'a' });

    const r = await uc.execute(CMD);

    expect(r.sinResolver).toEqual([]);
    expect(citas.get('a')!.status).toBe('cancelada');
    expect(notifier.reservationRescheduled).not.toHaveBeenCalled();
    expect(notifier.reservationCancelled).toHaveBeenCalledWith(citas.get('a'), {
      byAdmin: true,
      absence: { absentWorkerName: 'Estilista A' },
    });
    expect(r.impacts.find((i) => i.reservationId === 'a')).toMatchObject({
      outcome: 'cancelada',
    });
    expect(
      r.impacts.find((i) => i.reservationId === 'a')!.newWorkerId,
    ).toBeUndefined();
  });

  it.each([
    [
      'otro día',
      () => {
        const c = cita('a', '10:00');
        return Reservation.fromPersistence({
          id: 'a',
          scheduledAt: new Date('2030-03-13T10:00:00-05:00'),
          endedAt: new Date('2030-03-13T11:00:00-05:00'),
          workerId: 'ausente',
          workerPinned: false,
          status: c.status,
          contact: c.contact,
          lines: c.lines,
        } as never);
      },
    ],
    ['otra estilista', () => cita('a', '10:00', 60, 'libre')],
  ])(
    'una cita que la clienta movió (%s) mientras tanto no se toca ni se avisa',
    async (_n, movida) => {
      const { uc, notifier, citas, reservas } = montar();
      citas.set('a', movida());

      const r = await uc.execute(CMD);

      expect(r.impacts.map((i) => i.reservationId)).toEqual(['b']);
      expect(r.sinResolver).toEqual([]);
      expect(citas.get('a')!.status).toBe('pendiente');
      expect(notifier.reservationRescheduled).not.toHaveBeenCalled();
      expect(notifier.reservationCancelled).toHaveBeenCalledTimes(1);
      expect(reservas.save).toHaveBeenCalledTimes(1);
    },
  );

  it('el resultado describe lo que pasó: nueva estilista de la reasignada', async () => {
    const { uc } = montar();

    const r = await uc.execute(CMD);

    expect(r.impacts[0]).toMatchObject({
      reservationId: 'a',
      outcome: 'reasignada',
      newWorkerId: 'libre',
      newWorkerName: 'Estilista B',
    });
    expect(r.impacts[1]).toMatchObject({
      reservationId: 'b',
      outcome: 'cancelada',
    });
  });

  it('execute con datos inválidos es una promesa rechazada', async () => {
    const { uc } = montar();

    await expect(
      uc.execute({ workerId: 'ausente', dateYmd: 'no-es-fecha' }),
    ).rejects.toThrow(InvalidAbsenceError);
  });

  it('si re-planear falla tras guardar, se borra la ausencia y se relanza', async () => {
    const { uc, absences, planner } = montar();
    planner.planear
      .mockImplementationOnce(async () => plan([]))
      .mockImplementationOnce(async () => {
        throw new Error('base caída');
      });

    await expect(uc.execute(CMD)).rejects.toThrow('base caída');

    expect(absences.delete).toHaveBeenCalledWith('abs-1');
    expect(absences.filas).toEqual([]);
  });

  it('un aviso caído no revierte nada ni va a sinResolver (NF11)', async () => {
    const { uc, citas } = montar({ avisoCae: true });

    const r = await uc.execute(CMD);

    expect(r.sinResolver).toEqual([]);
    expect(citas.get('b')!.status).toBe('cancelada');
  });

  it('una cita que ya no existe al aplicar se omite', async () => {
    const { uc, citas } = montar();
    citas.delete('a');

    const r = await uc.execute(CMD);

    expect(r.sinResolver).toEqual([]);
    expect(r.impacts.map((i) => i.reservationId)).toEqual(['b']);
  });

  describe('executeExact', () => {
    it('reconstruye la ausencia desde la ventana guardada', async () => {
      const { uc, absences } = montar();
      const startsAt = new Date('2030-03-12T10:00:00-05:00');
      const endsAt = new Date('2030-03-12T12:00:00-05:00');

      const r = await uc.executeExact({
        workerId: 'ausente',
        startsAt,
        endsAt,
      });

      expect(r.absenceId).toBe('abs-1');
      expect(absences.filas[0].startsAt).toEqual(startsAt);
      expect(absences.filas[0].endsAt).toEqual(endsAt);
    });

    it('si la ventana ya terminó → InvalidAbsenceError y no guarda', async () => {
      const { uc, absences } = montar();

      await expect(
        uc.executeExact({
          workerId: 'ausente',
          startsAt: new Date('2030-03-10T10:00:00-05:00'),
          endsAt: NOW,
        }),
      ).rejects.toThrow(InvalidAbsenceError);
      expect(absences.save).not.toHaveBeenCalled();
    });
  });
});

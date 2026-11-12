import { MarkAbsenceUseCase } from './mark-absence.use-case';
import { AbsenceOverlapError, InvalidAbsenceError } from '../../domain/errors';
import { NOW, cita, plan, repoAusencias } from './absences-helpers-spec';

function montar(opts: { falla?: string; avisoCae?: boolean } = {}) {
  const absences = repoAusencias();
  const citas = new Map([
    ['a', cita('a', '10:00')],
    ['b', cita('b', '11:00')],
  ]);
  const reservas = {
    findById: jest.fn(async (id: string) => citas.get(id) ?? null),
    save: jest.fn(async (r: any) => {
      if (r.id === opts.falla) throw new Error('exclusion');
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
  );
  return { uc, absences, reservas, planner, notifier, citas };
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

    expect(r.sinResolver).toEqual(['a']);
    expect(citas.get('b')!.status).toBe('cancelada');
    expect(notifier.reservationCancelled).toHaveBeenCalledTimes(1);
    expect(notifier.reservationRescheduled).not.toHaveBeenCalled();
  });

  it('un aviso caído no revierte nada ni va a sinResolver (NF11)', async () => {
    const { uc, citas } = montar({ avisoCae: true });

    const r = await uc.execute(CMD);

    expect(r.sinResolver).toEqual([]);
    expect(citas.get('b')!.status).toBe('cancelada');
  });

  it('una cita que ya no existe al aplicar va a sinResolver', async () => {
    const { uc, citas } = montar();
    citas.delete('a');

    const r = await uc.execute(CMD);

    expect(r.sinResolver).toEqual(['a']);
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

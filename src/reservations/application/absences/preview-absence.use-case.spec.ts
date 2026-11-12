import { PreviewAbsenceUseCase } from './preview-absence.use-case';
import { AbsenceOverlapError } from '../../domain/errors';
import { NOW, plan, repoAusencias } from './absences-helpers-spec';
import { WorkerAbsence } from '../../domain/worker-absence';

function montar() {
  const absences = repoAusencias();
  const planner = { planear: jest.fn(async () => plan([])) };
  const uc = new PreviewAbsenceUseCase(
    absences as never,
    planner as never,
    { now: () => NOW } as never,
  );
  return { uc, absences, planner };
}

describe('PreviewAbsenceUseCase', () => {
  it('preview no guarda nada y devuelve el plan', async () => {
    const { uc, absences, planner } = montar();

    const r = await uc.execute({ workerId: 'ausente', dateYmd: '2030-03-12' });

    expect(r.workerName).toBe('Estilista A');
    expect(planner.planear).toHaveBeenCalledTimes(1);
    expect(absences.save).not.toHaveBeenCalled();
  });

  it('preview de una ausencia que se cruza con otra → AbsenceOverlapError', async () => {
    const { uc, absences } = montar();
    absences.filas.push(
      WorkerAbsence.fromPersistence({
        id: 'x',
        workerId: 'ausente',
        startsAt: new Date('2030-03-12T10:00:00-05:00'),
        endsAt: new Date('2030-03-12T12:00:00-05:00'),
      }),
    );

    await expect(
      uc.execute({
        workerId: 'ausente',
        dateYmd: '2030-03-12',
        from: '11:00',
        to: '13:00',
      }),
    ).rejects.toThrow(AbsenceOverlapError);
  });
});

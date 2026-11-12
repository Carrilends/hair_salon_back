import { ListAbsencesUseCase } from './list-absences.use-case';
import { NOW, repoAusencias } from './absences-helpers-spec';
import { WorkerAbsence } from '../../domain/worker-absence';

describe('ListAbsencesUseCase', () => {
  it('list devuelve solo futuras/en curso con el nombre de la estilista', async () => {
    const absences = repoAusencias();
    const mk = (id: string, w: string, s: string, e: string) =>
      WorkerAbsence.fromPersistence({
        id,
        workerId: w,
        startsAt: new Date(s),
        endsAt: new Date(e),
      });
    absences.filas.push(
      mk('pasada', 'ausente', '2030-03-10T14:00:00Z', '2030-03-10T20:00:00Z'),
      mk('en-curso', 'ausente', '2030-03-11T13:00:00Z', '2030-03-11T20:00:00Z'),
      mk('futura', 'otra', '2030-03-12T13:00:00Z', '2030-03-12T20:00:00Z'),
    );
    const workers = {
      findWorker: jest.fn(async (id: string) => ({
        id,
        name: id === 'ausente' ? 'Estilista A' : 'Estilista B',
        isDefault: false,
      })),
    };
    const uc = new ListAbsencesUseCase(
      absences as never,
      workers as never,
      {
        now: () => NOW,
      } as never,
    );

    const r = await uc.execute();

    expect(r.map((x) => [x.id, x.workerName])).toEqual([
      ['en-curso', 'Estilista A'],
      ['futura', 'Estilista B'],
    ]);
    expect(absences.listUpcoming).toHaveBeenCalledWith(NOW);
  });
});

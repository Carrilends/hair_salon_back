import { RemoveAbsenceUseCase } from './remove-absence.use-case';
import { AbsenceNotFoundError } from '../../domain/errors';

describe('RemoveAbsenceUseCase', () => {
  it('remove de una inexistente → AbsenceNotFoundError', async () => {
    const uc = new RemoveAbsenceUseCase({
      delete: jest.fn(async () => false),
    } as never);

    await expect(uc.execute('nope')).rejects.toThrow(AbsenceNotFoundError);
  });

  it('borra la ausencia existente', async () => {
    const del = jest.fn(async () => true);
    const uc = new RemoveAbsenceUseCase({ delete: del } as never);

    await uc.execute('abs-1');

    expect(del).toHaveBeenCalledWith('abs-1');
  });
});

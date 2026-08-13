import { GetMyReservationsUseCase } from './get-my-reservations.use-case';

describe('GetMyReservationsUseCase', () => {
  it('delega en findByUser con el id del usuario autenticado', async () => {
    const views = [{ id: 'r-1' }];
    let askedWith: string | undefined;
    const repo = {
      findByUser: async (userId: string) => {
        askedWith = userId;
        return views;
      },
    };
    const uc = new GetMyReservationsUseCase(repo as any);

    await expect(uc.execute('u-9')).resolves.toBe(views);
    expect(askedWith).toBe('u-9');
  });
});

import { ListActiveReservationsUseCase } from './list-active-reservations.use-case';

describe('ListActiveReservationsUseCase', () => {
  it('devuelve las reservas activas que el repositorio resuelve para el instante del reloj', async () => {
    const now = new Date('2026-04-20T12:00:00.000Z');
    const views = [{ id: 'r-1' }];
    let askedWith: Date | undefined;
    const repo = {
      findActiveWithWorker: async (n: Date) => {
        askedWith = n;
        return views;
      },
    };
    const clock = { now: () => now };
    const uc = new ListActiveReservationsUseCase(repo as any, clock as any);

    const result = await uc.execute();

    expect(result).toBe(views);
    expect(askedWith).toBe(now); // usa el reloj inyectado, no el del sistema
  });
});

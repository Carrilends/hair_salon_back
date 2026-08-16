import { SettlePastReservationsUseCase } from './settle-past-reservations.use-case';

describe('SettlePastReservationsUseCase', () => {
  it('salda las reservas pasadas usando el instante del reloj y devuelve el conteo', async () => {
    const now = new Date('2026-04-20T12:00:00.000Z');
    let askedWith: Date | undefined;
    const repo = {
      settlePastReservations: async (n: Date) => {
        askedWith = n;
        return 3;
      },
    };
    const clock = { now: () => now };
    const uc = new SettlePastReservationsUseCase(repo as any, clock as any);

    await expect(uc.execute()).resolves.toBe(3);
    expect(askedWith).toBe(now); // usa el reloj inyectado, no el del sistema
  });
});

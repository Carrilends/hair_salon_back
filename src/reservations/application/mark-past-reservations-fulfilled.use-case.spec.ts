import { MarkPastReservationsFulfilledUseCase } from './mark-past-reservations-fulfilled.use-case';

describe('MarkPastReservationsFulfilledUseCase', () => {
  it('marca cumplidas usando el instante del reloj y devuelve el conteo', async () => {
    const now = new Date('2026-04-20T12:00:00.000Z');
    let askedWith: Date | undefined;
    const repo = {
      markFulfilledEndedBefore: async (n: Date) => {
        askedWith = n;
        return 3;
      },
    };
    const clock = { now: () => now };
    const uc = new MarkPastReservationsFulfilledUseCase(
      repo as any,
      clock as any,
    );

    await expect(uc.execute()).resolves.toBe(3);
    expect(askedWith).toBe(now); // usa el reloj inyectado, no el del sistema
  });
});

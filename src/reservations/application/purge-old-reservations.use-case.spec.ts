import { PurgeOldReservationsUseCase } from './purge-old-reservations.use-case';

describe('PurgeOldReservationsUseCase', () => {
  it('borra por un corte de un mes antes del "ahora" del reloj inyectado', async () => {
    const now = new Date('2026-04-20T12:00:00.000Z');
    const clock = { now: () => now };
    let cutoff: Date | undefined;
    const repo = {
      deleteEndedBefore: async (c: Date) => {
        cutoff = c;
      },
    };
    const uc = new PurgeOldReservationsUseCase(repo as any, clock as any);

    await uc.execute();

    // Debe usar el reloj inyectado (no el del sistema) y restar un mes.
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff!.getTime()).toBeLessThan(now.getTime());
    const expected = new Date(now.getTime());
    expected.setMonth(expected.getMonth() - 1);
    expect(cutoff!.getTime()).toBe(expected.getTime());
  });
});

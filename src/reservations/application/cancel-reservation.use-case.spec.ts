import { CancelReservationUseCase } from './cancel-reservation.use-case';
import { ReservationNotFoundError } from '../domain/errors';

describe('CancelReservationUseCase', () => {
  it('elimina la reserva cuando existe', async () => {
    const repo = { deleteById: async () => true };
    const uc = new CancelReservationUseCase(repo as any);

    await expect(uc.execute('r-1')).resolves.toBeUndefined();
  });

  it('lanza ReservationNotFoundError cuando no existe', async () => {
    const repo = { deleteById: async () => false };
    const uc = new CancelReservationUseCase(repo as any);

    await expect(uc.execute('missing')).rejects.toThrow(
      ReservationNotFoundError,
    );
  });
});

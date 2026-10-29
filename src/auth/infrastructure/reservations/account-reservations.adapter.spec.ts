import { ReservationOrmEntity } from 'src/reservations/infrastructure/persistence/reservation.orm-entity';
import { AccountReservationsAdapter } from './account-reservations.adapter';

/**
 * El `EntityManager` de la transacción, simulado: solo expone el repositorio de
 * reservas. Si el adaptador pidiera cualquier otro (o usara uno inyectado), la
 * prueba lo notaría: no hay otro camino a los datos que este `tx`.
 */
function txCon(filas: Partial<ReservationOrmEntity>[]) {
  const repo = {
    find: jest.fn().mockResolvedValue(filas),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const tx = {
    getRepository: jest.fn((entidad: unknown) => {
      if (entidad !== ReservationOrmEntity) {
        throw new Error('repositorio inesperado');
      }
      return repo;
    }),
  };
  return { tx, repo };
}

const AHORA = new Date('2026-10-28T15:00:00.000Z');
const FUTURO = new Date('2026-11-02T16:00:00.000Z');
const PASADO = new Date('2026-10-27T16:00:00.000Z');
const CUENTA = { fullName: 'Ana Ficticia', email: 'ana@ejemplo.test' };

function fila(
  id: string,
  extra: Partial<ReservationOrmEntity> = {},
): Partial<ReservationOrmEntity> {
  return {
    id,
    status: 'pendiente',
    endedAt: FUTURO,
    customerName: null,
    customerPhoneE164: null,
    customerEmail: null,
    ...extra,
  };
}

describe('AccountReservationsAdapter.handOverAndDetach', () => {
  const sut = new AccountReservationsAdapter();

  it('lee solo las reservas de la cuenta, a través del tx y bloqueándolas', async () => {
    const { tx, repo } = txCon([]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(tx.getRepository).toHaveBeenCalledWith(ReservationOrmEntity);
    const opciones = repo.find.mock.calls[0][0];
    expect(opciones.where).toEqual({ userId: 'u-1' });
    expect(opciones.lock).toEqual({ mode: 'pessimistic_write' });
    expect(opciones.loadEagerRelations).toBe(false);
  });

  it('una vigente sin nombre y sin E.164 recibe el nombre y el correo', async () => {
    const { tx, repo } = txCon([fila('r-1')]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'r-1' },
      { customerName: 'Ana Ficticia', customerEmail: 'ana@ejemplo.test' },
    );
  });

  it('una vigente con E.164 recibe el nombre pero no el correo', async () => {
    const { tx, repo } = txCon([
      fila('r-1', {
        status: 'confirmada',
        customerPhone: '300 123 4567',
        customerPhoneE164: '573001234567',
      }),
    ]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'r-1' },
      { customerName: 'Ana Ficticia' },
    );
  });

  it('una vigente con customer_name ya lleno lo conserva', async () => {
    const { tx, repo } = txCon([
      fila('r-1', {
        customerName: 'Sofía (para otra persona)',
        customerPhoneE164: '573001234567',
      }),
    ]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('un customer_name con solo espacios cuenta como vacío', async () => {
    const { tx, repo } = txCon([
      fila('r-1', { customerName: '   ', customerPhoneE164: '573001234567' }),
    ]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'r-1' },
      { customerName: 'Ana Ficticia' },
    );
  });

  it('un teléfono que no se pudo normalizar (sin E.164) sí recibe el correo', async () => {
    const { tx, repo } = txCon([
      fila('r-1', {
        customerName: 'Ana',
        customerPhone: '123',
        customerPhoneE164: null,
      }),
    ]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).toHaveBeenCalledWith(
      { id: 'r-1' },
      { customerEmail: 'ana@ejemplo.test' },
    );
  });

  it('una pendiente con ended_at pasado no recibe nada', async () => {
    const { tx, repo } = txCon([fila('r-1', { endedAt: PASADO })]);

    const r = await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).not.toHaveBeenCalled();
    expect(r).toEqual({ vigentes: 0, detached: 1 });
  });

  it('una pendiente que termina justo en el momento del borrado no es vigente', async () => {
    const { tx, repo } = txCon([fila('r-1', { endedAt: new Date(AHORA) })]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('una cancelada futura no recibe nada', async () => {
    const { tx, repo } = txCon([fila('r-1', { status: 'cancelada' })]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('una cumplida no recibe nada', async () => {
    const { tx, repo } = txCon([
      fila('r-1', { status: 'cumplida', endedAt: PASADO }),
    ]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('no cancela ni toca user_id: solo escribe nombre y correo', async () => {
    const { tx, repo } = txCon([
      fila('r-1'),
      fila('r-2', { status: 'confirmada' }),
    ]);

    await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).toHaveBeenCalledTimes(2);
    for (const [, cambios] of repo.update.mock.calls) {
      expect(cambios).not.toHaveProperty('status');
      expect(cambios).not.toHaveProperty('userId');
    }
  });

  it('cuenta las vigentes y todas las que se desvincularán', async () => {
    const { tx } = txCon([
      fila('r-1'),
      fila('r-2', { status: 'confirmada', customerName: 'Ana' }),
      fila('r-3', { endedAt: PASADO }),
      fila('r-4', { status: 'cancelada' }),
      fila('r-5', { status: 'cumplida', endedAt: PASADO }),
    ]);

    const r = await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(r).toEqual({ vigentes: 2, detached: 5 });
  });

  it('sin reservas no escribe nada', async () => {
    const { tx, repo } = txCon([]);

    const r = await sut.handOverAndDetach(tx as never, 'u-1', CUENTA, AHORA);

    expect(repo.update).not.toHaveBeenCalled();
    expect(r).toEqual({ vigentes: 0, detached: 0 });
  });
});

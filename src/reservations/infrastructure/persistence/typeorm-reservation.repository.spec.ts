import { TypeOrmReservationRepository } from './typeorm-reservation.repository';
import { Reservation } from '../../domain/reservation';
import { ReservationStatus } from '../../domain/reservation-status';
import { WorkerOverlapError } from '../../domain/errors';

const line = {
  serviceId: 's-1',
  name: 'Corte',
  price: 30000,
  durationMinutes: 60,
};

function ormRow() {
  return {
    id: 'r-1',
    userId: 'u-1',
    customerName: null,
    customerPhone: null,
    customerEmail: null,
    scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
    endedAt: new Date('2026-08-20T15:00:00.000Z'),
    workerId: 'w-1',
    status: 'confirmada',
    services: [{ ...line }],
  };
}

function mockRepo() {
  return {
    create: jest.fn((x: any) => x),
    save: jest.fn(async (e: any) => ({ ...e, id: e.id ?? 'r-new' })),
    update: jest.fn(async () => ({ affected: 1 })),
    findOne: jest.fn(async () => ormRow()),
  };
}

describe('TypeOrmReservationRepository.save', () => {
  it('al actualizar una reserva existente NO reescribe las líneas de servicio (A1)', async () => {
    // Con cascade:true y sin orphanedRowAction, volver a pasar las líneas (sin
    // id) por repo.save las reinsertaría, duplicando reservation_services en cada
    // confirm/cancel. La ruta de actualización debe tocar solo columnas escalares.
    const repo = mockRepo();
    const sut = new TypeOrmReservationRepository(repo as any);
    const existing = Reservation.fromPersistence({
      id: 'r-1',
      userId: 'u-1',
      contact: null,
      scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
      endedAt: new Date('2026-08-20T15:00:00.000Z'),
      workerId: 'w-1',
      status: ReservationStatus.Confirmada,
      lines: [{ ...line }],
    });

    await sut.save(existing);

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.save).not.toHaveBeenCalled();
    const [criteria, partial] = repo.update.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(criteria).toBe('r-1');
    expect(partial).not.toHaveProperty('services');
    expect(partial).toMatchObject({ status: ReservationStatus.Confirmada });
  });

  it('al crear una reserva nueva persiste las líneas de servicio (INSERT con cascada)', async () => {
    const repo = mockRepo();
    const sut = new TypeOrmReservationRepository(repo as any);
    const nueva = Reservation.schedule({
      scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
      workerId: 'w-1',
      userId: 'u-1',
      lines: [{ ...line }],
    });

    await sut.save(nueva);

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.update).not.toHaveBeenCalled();
    const entity = repo.create.mock.calls[0][0];
    expect(entity.services).toHaveLength(1);
  });

  it('traduce la violación de exclusión de solape (23P01) a WorkerOverlapError (M5)', async () => {
    // El constraint de exclusión (btree_gist) es el backstop de la carrera: si
    // dos reservas concurrentes intentan solapar al mismo estilista, Postgres
    // rechaza la segunda; el repositorio la traduce a un error de dominio (409).
    const pgErr: any = new Error(
      'conflicting key value violates exclusion constraint',
    );
    pgErr.code = '23P01';
    const repo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(async () => {
        throw pgErr;
      }),
      update: jest.fn(),
      findOne: jest.fn(),
    };
    const sut = new TypeOrmReservationRepository(repo as any);
    const nueva = Reservation.schedule({
      scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
      workerId: 'w-1',
      userId: 'u-1',
      lines: [{ ...line }],
    });

    await expect(sut.save(nueva)).rejects.toThrow(WorkerOverlapError);
  });
});

describe('TypeOrmReservationRepository.settlePastReservations', () => {
  it('da por cumplidas las confirmadas pasadas y cancela las pendientes pasadas (M4)', async () => {
    // Respeta la máquina de estados: confirmada→cumplida y pendiente→cancelada
    // son transiciones válidas; el cron nunca hace el prohibido pendiente→cumplida.
    const updateCalls: Array<{ where: any; set: any }> = [];
    const repo = {
      update: jest.fn(async (where: any, set: any) => {
        updateCalls.push({ where, set });
        return { affected: 1 };
      }),
    };
    const sut = new TypeOrmReservationRepository(repo as any);

    const total = await sut.settlePastReservations(
      new Date('2026-08-20T12:00:00.000Z'),
    );

    expect(total).toBe(2); // 1 (cumplida) + 1 (cancelada)
    const cumplida = updateCalls.find((c) => c.set.status === 'cumplida');
    const cancelada = updateCalls.find((c) => c.set.status === 'cancelada');
    expect(cumplida?.where.status).toBe('confirmada');
    expect(cancelada?.where.status).toBe('pendiente');
  });
});

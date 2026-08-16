import { TypeOrmReservationRepository } from './typeorm-reservation.repository';
import { Reservation } from '../../domain/reservation';
import { ReservationStatus } from '../../domain/reservation-status';

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
});

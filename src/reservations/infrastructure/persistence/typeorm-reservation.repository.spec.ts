import { In, MoreThan, Not } from 'typeorm';
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
      workerPinned: false,
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
      workerPinned: false,
      userId: 'u-1',
      lines: [{ ...line }],
    });

    await expect(sut.save(nueva)).rejects.toThrow(WorkerOverlapError);
  });
});

describe('TypeOrmReservationRepository.findActiveWithWorker', () => {
  it('excluye las canceladas de la lista de reservas activas (D4)', async () => {
    // El panel de administración lista las reservas vigentes; una cancelada,
    // aunque su ventana aún no haya pasado, no está "activa" y no debe aparecer.
    const now = new Date('2026-08-20T12:00:00.000Z');
    const repo = { find: jest.fn(async () => []) };
    const sut = new TypeOrmReservationRepository(repo as any);

    await sut.findActiveWithWorker(now);

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endedAt: MoreThan(now), status: Not('cancelada') },
      }),
    );
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

/** Doble del query builder: anota las cláusulas `andWhere` que recibe. */
function mockQueryBuilder() {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  const qb: any = {
    clauses,
    params,
    where: jest.fn((c: string, p?: Record<string, unknown>) => {
      clauses.push(c);
      Object.assign(params, p ?? {});
      return qb;
    }),
    andWhere: jest.fn((c: string, p?: Record<string, unknown>) => {
      clauses.push(c);
      Object.assign(params, p ?? {});
      return qb;
    }),
    getCount: jest.fn(async () => 0),
  };
  return qb;
}

describe('TypeOrmReservationRepository.countOverlaps', () => {
  const inicio = new Date('2026-08-20T14:00:00.000Z');
  const fin = new Date('2026-08-20T15:00:00.000Z');

  it('excluye la propia reserva cuando se le pasa su id (reprogramación)', async () => {
    // Mover una cita dos horas dentro de su mismo día la haría solaparse consigo
    // misma: la fila ya está persistida y entra en el conteo. Sin esta exclusión,
    // toda reprogramación sería rechazada por un solape inexistente.
    const qb = mockQueryBuilder();
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const sut = new TypeOrmReservationRepository(repo as any);

    await sut.countOverlaps('w-1', inicio, fin, 'r-1');

    expect(qb.clauses).toContain('r.id <> :excludeReservationId');
    expect(qb.params.excludeReservationId).toBe('r-1');
  });

  it('sin id de exclusión no añade la cláusula (creación)', async () => {
    // Al crear todavía no hay id que excluir: la consulta debe quedar idéntica a
    // como estaba, para no cambiar el comportamiento del camino de creación.
    const qb = mockQueryBuilder();
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const sut = new TypeOrmReservationRepository(repo as any);

    await sut.countOverlaps('w-1', inicio, fin);

    expect(qb.clauses).not.toContain('r.id <> :excludeReservationId');
  });
});

describe('TypeOrmReservationRepository.save · rama de actualización', () => {
  it('traduce la violación de exclusión (23P01) también al ACTUALIZAR', async () => {
    // La traducción vivía solo en la rama INSERT. Con la reprogramación, un
    // cambio de hora es un UPDATE que puede violar el mismo constraint de
    // exclusión: sin traducir, saldría como un 500 crudo del driver en vez del
    // 409 que el filtro de dominio sabe devolver.
    const pgErr: any = new Error(
      'conflicting key value violates exclusion constraint',
    );
    pgErr.driverError = { code: '23P01' };
    const repo = {
      create: jest.fn((x: any) => x),
      save: jest.fn(),
      update: jest.fn(async () => {
        throw pgErr;
      }),
      findOne: jest.fn(async () => ormRow()),
    };
    const sut = new TypeOrmReservationRepository(repo as any);
    const existente = Reservation.fromPersistence({
      id: 'r-1',
      userId: 'u-1',
      contact: null,
      scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
      endedAt: new Date('2026-08-20T15:00:00.000Z'),
      workerId: 'w-1',
      status: ReservationStatus.Confirmada,
      lines: [{ ...line }],
    });

    await expect(sut.save(existente)).rejects.toThrow(WorkerOverlapError);
  });
});

describe('TypeOrmReservationRepository.findActiveByPhone', () => {
  it('filtra por teléfono normalizado, no terminales y aún no vencidas, en orden ascendente', async () => {
    // Es la consulta que sostiene el canal entrante: a partir del `wa_id` que
    // Meta pone en el webhook hay que llegar a las citas sobre las que ese
    // número puede actuar. Solo las suyas, solo las que aún se pueden mover.
    const now = new Date('2026-08-20T12:00:00.000Z');
    const repo = { find: jest.fn(async () => []) };
    const sut = new TypeOrmReservationRepository(repo as any);

    await sut.findActiveByPhone('573001234567', now);

    const [args] = repo.find.mock.calls[0] as unknown as [Record<string, any>];
    expect(args.where).toMatchObject({ customerPhoneE164: '573001234567' });
    expect(args.where.endedAt).toEqual(MoreThan(now));
    expect(args.where.status).toEqual(In(['pendiente', 'confirmada']));
    expect(args.order).toEqual({ scheduledAt: 'ASC' });
  });

  it('devuelve agregados de dominio, no vistas de lectura', async () => {
    // El flujo de WhatsApp va a mutar lo que reciba (cancelar, mover), así que
    // necesita el agregado con sus reglas, no un DTO plano de presentación.
    const repo = { find: jest.fn(async () => [ormRow()]) };
    const sut = new TypeOrmReservationRepository(repo as any);

    const [reserva] = await sut.findActiveByPhone('573001234567', new Date());

    expect(reserva).toBeInstanceOf(Reservation);
  });
});

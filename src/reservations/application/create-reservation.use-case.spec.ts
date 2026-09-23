import { CreateReservationUseCase } from './create-reservation.use-case';
import {
  OutOfBusinessHoursError,
  WorkerOverlapError,
  MissingContactError,
  InvalidReservationError,
  ReservationInThePastError,
  DuplicateServicesError,
} from '../domain/errors';
import { Reservation } from '../domain/reservation';
import { WorkerAssigner } from './worker-assigner';

const catalog = {
  getSnapshots: async (ids: string[]) =>
    ids.map((id) => ({
      id,
      name: 'Corte',
      price: 20000,
      durationMinutes: 30,
    })),
};

// Salón sin estilistas asignables dadas de alta: es el único caso en el que la
// reserva sin `workerId` sigue cayendo en el estilista por defecto. Los tests
// del reparto (más abajo) usan su propio doble con estilistas reales.
const workers = {
  countParallelStylists: async () => 3,
  getDefaultWorkerId: async () => 'default-w',
  listAssignableWorkloads: async () => [],
};

/**
 * El reparto ya no vive dentro del caso de uso: se extrajo a `WorkerAssigner`
 * para que la reprogramación use exactamente el mismo. Las pruebas siguen
 * pasando los mismos dobles, solo que envueltos en el repartidor REAL, de modo
 * que lo que se comprueba —y lo que se espera— no cambia.
 */
function assigner(repository: any, workersPort: any): WorkerAssigner {
  return new WorkerAssigner(repository, workersPort);
}

// "ahora" fijado antes de las fechas de prueba (2026-04-20): las reservas no
// son pasadas salvo que un test lo fuerce con su propio reloj.
const clock = { now: () => new Date('2026-04-01T00:00:00.000Z') };

// Notificador de no-op para los tests que no verifican la notificación.
const noopNotifier = { reservationCreated: async () => {} };

function repo() {
  return {
    overlaps: 0,
    countOverlaps: async function () {
      return this.overlaps;
    },
    save: async (r: Reservation) =>
      Reservation.fromPersistence({
        id: 'r-1',
        userId: r.userId,
        contact: r.contact,
        scheduledAt: r.scheduledAt,
        endedAt: r.endedAt,
        workerId: r.workerId,
        workerPinned: r.workerPinned,
        status: r.status,
        lines: r.lines,
      }),
  } as any;
}

describe('CreateReservationUseCase (maduro)', () => {
  beforeEach(() => {
    process.env.SALON_TZ = 'America/Bogota';
  });

  it('crea con 2 servicios y deriva 60 min de duración', async () => {
    const repositorio = repo();
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1', 's2'],
      userId: 'u-1',
    });
    expect(result.totalDurationMinutes).toBe(60);
    expect(result.id).toBe('r-1');
  });

  // Antes este test se llamaba «usa el estilista por defecto cuando no se envía
  // workerId» y valía para todos los casos. Ya no: desde que el caso de uso
  // reparte entre las estilistas asignables, caer en el por defecto es solo lo
  // que ocurre cuando NO hay ninguna asignable dada de alta. El valor esperado
  // (`default-w`) no cambia; lo que cambia es la condición que lo justifica.
  it('usa el estilista por defecto solo si no hay estilistas asignables', async () => {
    const repositorio = repo();
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1'],
      userId: 'u-1',
    });
    expect(result.workerId).toBe('default-w');
  });

  it('exige contacto si la reserva es anónima', async () => {
    const repositorio = repo();
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1'],
      }),
    ).rejects.toThrow(MissingContactError);
  });

  it('rechaza cuando algún servicio no existe en el catálogo', async () => {
    const emptyCatalog = { getSnapshots: async () => [] };
    const repositorio = repo();
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),

      emptyCatalog as any,
      clock as any,
      noopNotifier as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(InvalidReservationError);
  });

  it('rechaza fuera de horario', async () => {
    const repositorio = repo();
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-21T03:00:00.000Z', // 22:00 Bogotá
        serviceIds: ['s1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(OutOfBusinessHoursError);
  });

  it('rechaza serviceIds duplicados con un error claro (no "no existe")', async () => {
    const repositorio = repo();
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1', 's1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(DuplicateServicesError);
  });

  it('rechaza una reserva cuya hora de inicio ya pasó', async () => {
    // "ahora" es una hora posterior al inicio solicitado: la reserva es pasada.
    const lateClock = { now: () => new Date('2026-04-20T16:00:00.000Z') };
    const repositorio = repo();
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),
      catalog as any,
      lateClock as any,
      noopNotifier as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z', // 10:00 Bogotá, una hora antes de "ahora"
        serviceIds: ['s1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(ReservationInThePastError);
  });

  it('rechaza por solapamiento', async () => {
    const r = repo();
    r.overlaps = 1;
    const repositorio = r;
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(WorkerOverlapError);
  });

  it('notifica exactamente una vez tras crear la reserva', async () => {
    const notificadas: Reservation[] = [];
    const notifier = {
      reservationCreated: async (r: Reservation) => {
        notificadas.push(r);
      },
    };
    const repositorio = repo();
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),
      catalog as any,
      clock as any,
      notifier as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1'],
      userId: 'u-1',
    });
    expect(notificadas).toHaveLength(1);
    expect(notificadas[0].id).toBe(result.id);
  });

  it('crea la reserva aunque la notificación falle (N8)', async () => {
    // El puerto es una interfaz: aunque el despachador ya aísle fallos, el caso
    // de uso no debe confiar en ello. Un notificador que lanza NO debe impedir
    // que la reserva —ya persistida— se devuelva al cliente.
    const notifier = {
      reservationCreated: async () => {
        throw new Error('canal caído');
      },
    };
    const repositorio = repo();
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workers as any),
      catalog as any,
      clock as any,
      notifier as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1'],
      userId: 'u-1',
    });
    expect(result.id).toBe('r-1');
  });
});

/**
 * Asignación automática de estilista.
 *
 * La restricción de exclusión de `reservations` es POR estilista
 * (`worker_id WITH =`), así que mandar al pseudo-estilista por defecto todo lo
 * que llega sin `workerId` dejaba al salón con capacidad 1: la segunda cita
 * simultánea la rechazaba Postgres aunque hubiera sillas libres. Llegan aquí
 * sin `workerId` tanto el chat (RF57/RF58, que no habla de estilistas) como el
 * portal cuando la clienta marca «Sin preferencia».
 */
describe('CreateReservationUseCase — asignación de estilista', () => {
  beforeEach(() => {
    process.env.SALON_TZ = 'America/Bogota';
  });

  /** Repositorio cuyo solape depende del estilista consultado. */
  function repoPorEstilista(ocupados: string[]) {
    return {
      countOverlaps: async (workerId: string) =>
        ocupados.includes(workerId) ? 1 : 0,
      save: async (r: Reservation) =>
        Reservation.fromPersistence({
          id: 'r-1',
          userId: r.userId,
          contact: r.contact,
          scheduledAt: r.scheduledAt,
          endedAt: r.endedAt,
          workerId: r.workerId,
          workerPinned: r.workerPinned,
          status: r.status,
          lines: r.lines,
        }),
    } as any;
  }

  /** Puerto de estilistas con una lista de asignables y su carga del día. */
  function workersCon(asignables: { id: string; usedMinutes: number }[]): any {
    return {
      countParallelStylists: async () => asignables.length,
      getDefaultWorkerId: async () => 'default-w',
      listAssignableWorkloads: async () => asignables,
    };
  }

  it('asigna una estilista asignable libre en vez del estilista por defecto', async () => {
    const repositorio = repoPorEstilista(['w-ocupada']);
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(
        repositorio,
        workersCon([
          { id: 'w-ocupada', usedMinutes: 0 },
          { id: 'w-libre', usedMinutes: 120 },
        ]),
      ),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1'],
      userId: 'u-1',
    });
    expect(result.workerId).toBe('w-libre');
  });

  it('entre varias libres elige la que menos minutos tiene ocupados ese día', async () => {
    const repositorio = repoPorEstilista([]);
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(
        repositorio,
        workersCon([
          { id: 'w-cargada', usedMinutes: 300 },
          { id: 'w-descansada', usedMinutes: 30 },
          { id: 'w-media', usedMinutes: 120 },
        ]),
      ),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1'],
      userId: 'u-1',
    });
    expect(result.workerId).toBe('w-descansada');
  });

  it('rechaza por solape solo cuando NINGUNA asignable está libre', async () => {
    const repositorio = repoPorEstilista(['w-a', 'w-b']);
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(
        repositorio,
        workersCon([
          { id: 'w-a', usedMinutes: 0 },
          { id: 'w-b', usedMinutes: 0 },
        ]),
      ),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(WorkerOverlapError);
  });

  it('respeta el workerId explícito y no lo reasigna aunque esté ocupado', async () => {
    const repositorio = repoPorEstilista(['w-elegida']);
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(
        repositorio,
        workersCon([
          { id: 'w-elegida', usedMinutes: 0 },
          { id: 'w-libre', usedMinutes: 0 },
        ]),
      ),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    // Quien pide una estilista concreta (portal) no debe acabar con otra: si esa
    // no puede, es un 409, no una sustitución silenciosa.
    await expect(
      uc.execute({
        scheduledAt: '2026-04-20T15:00:00.000Z',
        serviceIds: ['s1'],
        workerId: 'w-elegida',
        userId: 'u-1',
      }),
    ).rejects.toThrow(WorkerOverlapError);
  });

  /**
   * El origen de la asignación se decide AQUÍ y en ningún otro sitio: el caso de
   * uso es el único que ve si el `workerId` llegó de fuera. Si esta marca se
   * pierde, la reprogramación reasignará a una clienta que sí había elegido
   * estilista, y ella se entera el día de la cita.
   */
  it('marca la reserva cuando la clienta eligió estilista', async () => {
    const repositorio = repoPorEstilista([]);
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workersCon([{ id: 'w-elegida', usedMinutes: 0 }])),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1'],
      workerId: 'w-elegida',
      userId: 'u-1',
    });
    expect(result.workerPinned).toBe(true);
  });

  it('NO la marca cuando la estilista la repartió el sistema', async () => {
    const repositorio = repoPorEstilista([]);
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workersCon([{ id: 'w-a', usedMinutes: 0 }])),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1'],
      userId: 'u-1',
    });
    expect(result.workerId).toBe('w-a');
    expect(result.workerPinned).toBe(false);
  });

  it('tampoco la marca en el caso degenerado del estilista por defecto', async () => {
    // Sin estilistas asignables dadas de alta la reserva cae en el
    // pseudo-estilista por defecto. Sigue siendo una asignación del sistema, no
    // una elección: marcarla la dejaría clavada ahí para siempre.
    const repositorio = repoPorEstilista([]);
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workersCon([])),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    const result = await uc.execute({
      scheduledAt: '2026-04-20T15:00:00.000Z',
      serviceIds: ['s1'],
      userId: 'u-1',
    });
    expect(result.workerId).toBe('default-w');
    expect(result.workerPinned).toBe(false);
  });

  it('el horario manda sobre la asignación: fuera de horario no se busca estilista', async () => {
    // Si se eligiera estilista antes de validar la agenda, una petición a las
    // 22:00 con todas ocupadas diría "no hay disponibilidad" en vez de "está
    // cerrado", que es la razón verdadera.
    const repositorio = repoPorEstilista(['w-a']);
    const uc = new CreateReservationUseCase(
      repositorio,
      assigner(repositorio, workersCon([{ id: 'w-a', usedMinutes: 0 }])),
      catalog as any,
      clock as any,
      noopNotifier as any,
    );
    await expect(
      uc.execute({
        scheduledAt: '2026-04-21T03:00:00.000Z', // 22:00 Bogotá
        serviceIds: ['s1'],
        userId: 'u-1',
      }),
    ).rejects.toThrow(OutOfBusinessHoursError);
  });
});

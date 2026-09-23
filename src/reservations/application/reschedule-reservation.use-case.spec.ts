import { RescheduleReservationUseCase } from './reschedule-reservation.use-case';
import { Reservation } from '../domain/reservation';
import { ReservationStatus } from '../domain/reservation-status';
import {
  OutOfBusinessHoursError,
  RescheduleTooLateError,
  ReservationInThePastError,
  ReservationNotFoundError,
  ReservationOwnershipError,
  WorkerOverlapError,
  ChosenWorkerBusyError,
} from '../domain/errors';

const lines = [
  { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 60 },
];

// 2026-04-20 es lunes. 14:00Z = 09:00 en Bogotá (dentro del horario L–V 08–20).
const AHORA = new Date('2026-04-20T12:00:00.000Z');
const ORIGINAL = new Date('2026-04-20T15:00:00.000Z'); // 10:00 Bogotá
const NUEVA = new Date('2026-04-21T16:00:00.000Z'); // martes 11:00 Bogotá

/**
 * Fixture de reserva. `workerPinned` viene en `true` por defecto **a propósito**:
 * estas pruebas se escribieron cuando la estilista de una cita nunca cambiaba,
 * así que el escenario que describen es el de una clienta que la eligió. Las
 * pruebas del reparto (más abajo) construyen las suyas sin marcar.
 */
function reserva(
  overrides: Partial<{
    status: ReservationStatus;
    workerPinned: boolean;
  }> = {},
) {
  return Reservation.fromPersistence({
    id: 'r-1',
    userId: 'u-1',
    contact: null,
    scheduledAt: ORIGINAL,
    endedAt: new Date('2026-04-20T16:00:00.000Z'),
    workerId: 'w-1',
    workerPinned: overrides.workerPinned ?? true,
    status: overrides.status ?? ReservationStatus.Pendiente,
    lines,
  });
}

/**
 * Repartidor espía. Devuelve la estilista indicada (o lanza) y anota cada
 * llamada, que es como se comprueba que la rama marcada **no** lo consulta.
 */
function asignador(resultado: string | Error) {
  const llamadas: unknown[][] = [];
  const port = {
    elegir: async (...args: unknown[]) => {
      llamadas.push(args);
      if (resultado instanceof Error) throw resultado;
      return resultado;
    },
  } as any;
  return { port, llamadas };
}

/**
 * Repartidor que grita si alguien lo llama. Lo usan las pruebas de la rama
 * marcada: consultarlo siquiera ya sería un defecto.
 */
const asignadorProhibido = {
  elegir: async () => {
    throw new Error('el reparto no debería consultarse con estilista elegida');
  },
} as any;

function repo(
  r: Reservation | null,
  opts: { overlaps?: number } = {},
): {
  port: any;
  guardados: Reservation[];
  overlapArgs: unknown[][];
} {
  const guardados: Reservation[] = [];
  const overlapArgs: unknown[][] = [];
  const port = {
    findById: async () => r,
    countOverlaps: async (...args: unknown[]) => {
      overlapArgs.push(args);
      return opts.overlaps ?? 0;
    },
    save: async (x: Reservation) => {
      guardados.push(x);
      return x;
    },
  };
  return { port, guardados, overlapArgs };
}

const clock = { now: () => AHORA } as any;
const noopNotifier = {
  reservationCreated: async () => undefined,
  reservationCancelled: async () => undefined,
  reservationRescheduled: async () => undefined,
} as any;

beforeEach(() => {
  process.env.SALON_TZ = 'America/Bogota';
  delete process.env.RESCHEDULE_MIN_LEAD_MINUTES;
});

describe('RescheduleReservationUseCase · orden canónico de validación', () => {
  it('mueve la reserva y la persiste', async () => {
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    const result = await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    // El caso de uso ya no devuelve el agregado a secas: devuelve la operación
    // (`{ reservation, workerChanged }`), porque «cambió la estilista» es un
    // hecho del movimiento y no un campo de la reserva guardada.
    expect(result.reservation.scheduledAt).toEqual(NUEVA);
    expect(guardados).toHaveLength(1);
  });

  it('lanza ReservationNotFoundError si no existe', async () => {
    const { port } = repo(null);
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(ReservationNotFoundError);
  });

  it('comprueba la propiedad ANTES de tocar el agregado', async () => {
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'otra' }),
    ).rejects.toThrow(ReservationOwnershipError);
    expect(guardados).toHaveLength(0);
  });

  it('respeta el plazo del agregado', async () => {
    const { port } = repo(reserva());
    const tarde = { now: () => new Date('2026-04-20T16:00:00.000Z') } as any;
    const uc = new RescheduleReservationUseCase(
      port,
      tarde,
      noopNotifier,
      asignadorProhibido,
    );

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(RescheduleTooLateError);
  });

  it('rechaza una hora fuera del horario del salón', async () => {
    // 2026-04-21T03:00Z = 22:00 del lunes en Bogotá, después del cierre.
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await expect(
      uc.execute('r-1', '2026-04-21T03:00:00.000Z', {
        kind: 'user',
        userId: 'u-1',
      }),
    ).rejects.toThrow(OutOfBusinessHoursError);
    expect(guardados).toHaveLength(0);
  });

  it('rechaza mover la cita al pasado', async () => {
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await expect(
      uc.execute('r-1', '2026-04-19T15:00:00.000Z', {
        kind: 'user',
        userId: 'u-1',
      }),
    ).rejects.toThrow(ReservationInThePastError);
    expect(guardados).toHaveLength(0);
  });

  it('excluye la propia reserva al contar solapes', async () => {
    // Sin esto, la fila ya persistida se contaría a sí misma y ninguna
    // reprogramación sería posible.
    const { port, overlapArgs } = repo(reserva());
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(overlapArgs[0][3]).toBe('r-1');
  });

  it('lanza WorkerOverlapError si el estilista ya está ocupado', async () => {
    const { port, guardados } = repo(reserva(), { overlaps: 1 });
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(WorkerOverlapError);
    expect(guardados).toHaveLength(0);
  });

  it('un agregado que falla una validación posterior NUNCA se persiste', async () => {
    // El mutador ya corrió cuando se valida el horario: si algo falla después,
    // lo único que importa es que no llegue al repositorio.
    const { port, guardados } = repo(reserva(), { overlaps: 3 });
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow();
    expect(guardados).toHaveLength(0);
  });
});

describe('RescheduleReservationUseCase · margen de antelación', () => {
  it('aplica RESCHEDULE_MIN_LEAD_MINUTES a quien no es administración', async () => {
    process.env.RESCHEDULE_MIN_LEAD_MINUTES = '240'; // 4 h; la cita es en 3 h
    const { port } = repo(reserva());
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(RescheduleTooLateError);
  });

  it('no se lo aplica a administración', async () => {
    process.env.RESCHEDULE_MIN_LEAD_MINUTES = '240';
    const { port, guardados } = repo(reserva());
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await uc.execute('r-1', NUEVA.toISOString(), { kind: 'admin' });

    expect(guardados).toHaveLength(1);
  });
});

describe('RescheduleReservationUseCase · aviso', () => {
  it('avisa después de persistir, con la hora ANTERIOR y quién movió', async () => {
    const avisos: any[] = [];
    const { port } = repo(reserva());
    const espia = {
      reservationRescheduled: async (r: Reservation, meta: unknown) => {
        avisos.push({ id: r.id, meta });
      },
    } as any;
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      espia,
      asignadorProhibido,
    );

    await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(avisos).toHaveLength(1);
    // `workerChanged` se suma a la meta: es el tercer motivo por el que a la
    // clienta hay que contarle una reprogramación (ver el describe del aviso).
    // Aquí la reserva tiene estilista elegida, así que nunca cambia.
    expect(avisos[0].meta).toEqual({
      previousScheduledAt: ORIGINAL,
      byAdmin: false,
      workerChanged: false,
    });
  });

  it('un fallo del aviso NO deshace la reprogramación', async () => {
    const { port, guardados } = repo(reserva());
    const roto = {
      reservationRescheduled: async () => {
        throw new Error('sin red');
      },
    } as any;
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      roto,
      asignadorProhibido,
    );

    const result = await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(result.reservation.scheduledAt).toEqual(NUEVA);
    expect(guardados).toHaveLength(1);
  });
});

/**
 * El reparto al reprogramar.
 *
 * Comprobar el solape contra **una sola** agenda rechazaba citas con el salón
 * medio vacío: si la estilista asignada estaba ocupada a la hora nueva se
 * devolvía 409 aunque las otras estuvieran libres. Y esa estilista podía no
 * haberla elegido nadie —«Sin preferencia» en el portal, o el chat, que nunca
 * manda estilista—. Desde aquí, la agenda contra la que se comprueba depende de
 * quién eligió: la clienta o el sistema.
 */
describe('RescheduleReservationUseCase · reparto de estilista', () => {
  it('con estilista elegida y ocupada: 409, sin tocar la estilista ni consultar el reparto', async () => {
    const { port, guardados } = repo(reserva({ workerPinned: true }), {
      overlaps: 1,
    });
    const reparto = asignador('w-libre');
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      reparto.port,
    );

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(WorkerOverlapError);
    expect(guardados).toHaveLength(0);
    // Lo que de verdad protege a la clienta: no es que haya salido 409, es que
    // ni siquiera se planteó darle otra estilista.
    expect(reparto.llamadas).toHaveLength(0);
  });

  it('sin estilista elegida: si la suya está ocupada pero otra está libre, se mueve con la otra', async () => {
    const { port, guardados } = repo(reserva({ workerPinned: false }));
    const reparto = asignador('w-2');
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      reparto.port,
    );

    const result = await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(result.reservation.workerId).toBe('w-2');
    // Y llega así a la persistencia, que es lo único que cuenta el día de la cita.
    expect(guardados[0].workerId).toBe('w-2');
    expect(guardados[0].scheduledAt).toEqual(NUEVA);
  });

  it('el reparto se excluye a sí misma: su propia fila no la deja fuera', async () => {
    // Al mover una cita a una ventana que se solapa con la suya actual, su
    // propia fila haría parecer ocupada a su estilista y la sacaría del reparto.
    const { port } = repo(reserva({ workerPinned: false }));
    const reparto = asignador('w-2');
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      reparto.port,
    );

    await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(reparto.llamadas[0][3]).toEqual({ excludeReservationId: 'r-1' });
  });

  it('sin estilista elegida y con NINGUNA libre: 409', async () => {
    const { port, guardados } = repo(reserva({ workerPinned: false }));
    const reparto = asignador(new WorkerOverlapError());
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      reparto.port,
    );

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(WorkerOverlapError);
    expect(guardados).toHaveLength(0);
  });

  it('el horario manda sobre el reparto: fuera de horario no se busca estilista', async () => {
    // Mismo orden canónico (A6) que la creación: una petición a las 22:00 debe
    // decir «está cerrado», no «no hay disponibilidad».
    const { port } = repo(reserva({ workerPinned: false }));
    const reparto = asignador('w-2');
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      reparto.port,
    );

    await expect(
      uc.execute('r-1', '2026-04-21T03:00:00.000Z', {
        kind: 'user',
        userId: 'u-1',
      }),
    ).rejects.toThrow(OutOfBusinessHoursError);
    expect(reparto.llamadas).toHaveLength(0);
  });
});

/**
 * Dos motivos para el mismo 409.
 *
 * Un 409 mudo era defendible cuando solo había una causa. Ahora hay dos con
 * remedios distintos —«tu estilista no puede a esa hora» (cambia de hora **o**
 * de estilista) frente a «el salón está lleno» (cambia de hora)— y callarlo
 * obliga a la clienta a adivinar cuál de los dos es. Se distinguen **por tipo**,
 * no por el texto del mensaje: un texto se traduce, se acorta y se desincroniza.
 */
describe('RescheduleReservationUseCase · el 409 dice por qué', () => {
  it('estilista elegida ocupada → ChosenWorkerBusyError', async () => {
    const { port } = repo(reserva({ workerPinned: true }), { overlaps: 1 });
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      asignadorProhibido,
    );

    await expect(
      uc.execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' }),
    ).rejects.toThrow(ChosenWorkerBusyError);
  });

  it('salón lleno → WorkerOverlapError, y NO ChosenWorkerBusyError', async () => {
    const { port } = repo(reserva({ workerPinned: false }));
    const reparto = asignador(new WorkerOverlapError());
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      noopNotifier,
      reparto.port,
    );

    const error = await uc
      .execute('r-1', NUEVA.toISOString(), { kind: 'user', userId: 'u-1' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WorkerOverlapError);
    expect(error).not.toBeInstanceOf(ChosenWorkerBusyError);
  });

  /**
   * `ChosenWorkerBusyError` **hereda** de `WorkerOverlapError` para que todo lo
   * que ya comprobaba el genérico —el filtro HTTP que devuelve 409 y el mapeo de
   * motivos del asistente— siga funcionando sin cambios, y ningún camino se
   * quede sin traducción por olvido. El precio es que las comprobaciones
   * específicas tienen que ir ANTES que la genérica; esto lo fija.
   */
  it('el motivo específico sigue siendo un solape para quien solo mira el genérico', () => {
    expect(new ChosenWorkerBusyError()).toBeInstanceOf(WorkerOverlapError);
  });
});

/**
 * El aviso de que cambió la estilista.
 *
 * Reasignar resuelve un 409 innecesario, pero cambia algo que la clienta no
 * pidió: se movió la hora **y** cambió la persona. RF68 c.3 solo le cuenta las
 * reprogramaciones hechas por la peluquería (`byAdmin`), porque las suyas ya se
 * las confirmó el canal por el que las hizo; aquí aparece un **tercer motivo**
 * que el requerimiento no contemplaba: su estilista cambió, aunque moviera ella
 * la cita. Sin este dato el aviso no puede existir, así que el caso de uso —el
 * único sitio que conoce el antes y el después— tiene que declararlo.
 *
 * Y solo cuando **de verdad** cambió: decir «tu estilista sigue siendo la misma»
 * en cada reprogramación sería ruido, y el ruido se acaba ignorando.
 */
describe('RescheduleReservationUseCase · aviso de cambio de estilista', () => {
  /** Notificador espía: guarda la meta con la que se le avisó. */
  function notificador() {
    const avisos: { meta: Record<string, unknown> }[] = [];
    const port = {
      reservationRescheduled: async (
        _r: Reservation,
        meta: Record<string, unknown>,
      ) => {
        avisos.push({ meta });
      },
    } as any;
    return { port, avisos };
  }

  it('sin estilista elegida y con reasignación: lo declara en el resultado y en el aviso', async () => {
    const { port } = repo(reserva({ workerPinned: false }));
    const reparto = asignador('w-2');
    const espia = notificador();
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      espia.port,
      reparto.port,
    );

    const result = await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(result.workerChanged).toBe(true);
    expect(espia.avisos[0].meta).toMatchObject({ workerChanged: true });
  });

  it('si el reparto devuelve la MISMA estilista, no hay nada que avisar', async () => {
    // El reparto ordena por carga, así que devolver la misma es lo más probable
    // cuando la agenda está tranquila. Avisar de un cambio que no ocurrió sería
    // mentir; repetir «sigue siendo la misma» en cada movimiento sería ruido.
    const { port } = repo(reserva({ workerPinned: false }));
    const reparto = asignador('w-1');
    const espia = notificador();
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      espia.port,
      reparto.port,
    );

    const result = await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(result.workerChanged).toBe(false);
    expect(espia.avisos[0].meta).toMatchObject({ workerChanged: false });
  });

  it('con estilista elegida nunca hay cambio que avisar', async () => {
    const { port } = repo(reserva({ workerPinned: true }));
    const espia = notificador();
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      espia.port,
      asignadorProhibido,
    );

    const result = await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(result.workerChanged).toBe(false);
    expect(espia.avisos[0].meta).toMatchObject({ workerChanged: false });
  });

  it('un fallo del aviso NO deshace la reprogramación ni la reasignación (NF11)', async () => {
    // El canal que avisa del cambio de estilista es uno más: si se cae, la cita
    // ya está movida y persistida. NF11 manda que el fallo no propague.
    const { port, guardados } = repo(reserva({ workerPinned: false }));
    const reparto = asignador('w-2');
    const roto = {
      reservationRescheduled: async () => {
        throw new Error('sin red');
      },
    } as any;
    const uc = new RescheduleReservationUseCase(
      port,
      clock,
      roto,
      reparto.port,
    );

    const result = await uc.execute('r-1', NUEVA.toISOString(), {
      kind: 'user',
      userId: 'u-1',
    });

    expect(result.workerChanged).toBe(true);
    expect(guardados[0].workerId).toBe('w-2');
  });
});

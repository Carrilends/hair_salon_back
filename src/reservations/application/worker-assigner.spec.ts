import { WorkerAssigner } from './worker-assigner';
import { WorkerOverlapError } from '../domain/errors';

const INICIO = new Date('2026-04-20T15:00:00.000Z');
const FIN = new Date('2026-04-20T16:00:00.000Z');
const TZ = 'America/Bogota';

/** Repositorio cuyo solape depende del estilista consultado. */
function repo(ocupados: string[]) {
  const llamadas: unknown[][] = [];
  const port = {
    countOverlaps: async (...args: unknown[]) => {
      llamadas.push(args);
      return ocupados.includes(args[0] as string) ? 1 : 0;
    },
  } as any;
  return { port, llamadas };
}

function workers(asignables: { id: string; usedMinutes: number }[]) {
  return {
    countParallelStylists: async () => asignables.length,
    getDefaultWorkerId: async () => 'default-w',
    listAssignableWorkloads: async () => asignables,
  } as any;
}

/**
 * El reparto vivía dentro de `CreateReservationUseCase`. Se extrae porque la
 * reprogramación necesita exactamente el mismo criterio con una sola diferencia
 * (excluirse a sí misma), y las dos alternativas eran peores: copiarlo garantiza
 * que diverjan, y que un caso de uso llame a otro los acopla.
 */
describe('WorkerAssigner', () => {
  it('elige una estilista libre en vez de una ocupada', async () => {
    const { port } = repo(['w-ocupada']);
    const assigner = new WorkerAssigner(
      port,
      workers([
        { id: 'w-ocupada', usedMinutes: 0 },
        { id: 'w-libre', usedMinutes: 120 },
      ]),
    );

    expect(await assigner.elegir(INICIO, FIN, TZ)).toBe('w-libre');
  });

  it('entre varias libres elige la que menos minutos tiene ese día', async () => {
    const { port } = repo([]);
    const assigner = new WorkerAssigner(
      port,
      workers([
        { id: 'w-cargada', usedMinutes: 300 },
        { id: 'w-descansada', usedMinutes: 30 },
        { id: 'w-media', usedMinutes: 120 },
      ]),
    );

    expect(await assigner.elegir(INICIO, FIN, TZ)).toBe('w-descansada');
  });

  it('desempata por id para que la elección sea determinista', async () => {
    const { port } = repo([]);
    const assigner = new WorkerAssigner(
      port,
      workers([
        { id: 'w-b', usedMinutes: 60 },
        { id: 'w-a', usedMinutes: 60 },
      ]),
    );

    expect(await assigner.elegir(INICIO, FIN, TZ)).toBe('w-a');
  });

  it('lanza WorkerOverlapError si NINGUNA está libre', async () => {
    const { port } = repo(['w-a', 'w-b']);
    const assigner = new WorkerAssigner(
      port,
      workers([
        { id: 'w-a', usedMinutes: 0 },
        { id: 'w-b', usedMinutes: 0 },
      ]),
    );

    await expect(assigner.elegir(INICIO, FIN, TZ)).rejects.toThrow(
      WorkerOverlapError,
    );
  });

  it('cae en el estilista por defecto si no hay asignables dadas de alta', async () => {
    const { port } = repo([]);
    const assigner = new WorkerAssigner(port, workers([]));

    expect(await assigner.elegir(INICIO, FIN, TZ)).toBe('default-w');
  });

  /**
   * La única diferencia real entre el uso de la creación y el de la
   * reprogramación, y no es cosmética: al mover una cita a una ventana que se
   * solapa con la suya actual, su propia fila haría parecer ocupada a su
   * estilista y la sacaría del reparto.
   */
  it('propaga excludeReservationId a la consulta de solapes', async () => {
    const { port, llamadas } = repo([]);
    const assigner = new WorkerAssigner(
      port,
      workers([{ id: 'w-a', usedMinutes: 0 }]),
    );

    await assigner.elegir(INICIO, FIN, TZ, { excludeReservationId: 'r-1' });

    expect(llamadas[0]).toEqual(['w-a', INICIO, FIN, 'r-1']);
  });

  it('sin la opción no excluye ninguna reserva', async () => {
    const { port, llamadas } = repo([]);
    const assigner = new WorkerAssigner(
      port,
      workers([{ id: 'w-a', usedMinutes: 0 }]),
    );

    await assigner.elegir(INICIO, FIN, TZ);

    expect(llamadas[0]).toEqual(['w-a', INICIO, FIN, undefined]);
  });
});

import { AbsencePlanner } from './absence-planner';
import { WorkerAbsence } from '../../domain/worker-absence';
import { Reservation } from '../../domain/reservation';
import {
  DefaultWorkerAbsenceError,
  WorkerNotFoundError,
  WorkerOverlapError,
} from '../../domain/errors';

const TZ = 'America/Bogota';
const NOW = new Date('2030-03-11T15:00:00Z');
// Martes 2030-03-12; Bogotá = UTC-5.
const utc = (hhmm: string) => new Date(`2030-03-12T${hhmm}:00-05:00`);

function ausencia(from?: string, to?: string) {
  return WorkerAbsence.create({
    workerId: 'ausente',
    dateYmd: '2030-03-12',
    from,
    to,
    now: NOW,
    tz: TZ,
  });
}

function cita(
  id: string,
  desde: string,
  minutos: number,
  pinned = false,
): Reservation {
  return Reservation.fromPersistence({
    id,
    scheduledAt: utc(desde),
    endedAt: new Date(utc(desde).getTime() + minutos * 60_000),
    workerId: 'ausente',
    workerPinned: pinned,
    status: 'pendiente' as never,
    contact: { name: 'Clienta Prueba', phone: '+573001112233' },
    lines: [
      { serviceId: 's1', name: 'Corte', price: 1, durationMinutes: minutos },
    ],
  });
}

const NOMBRES: Record<
  string,
  { id: string; name: string; isDefault: boolean }
> = {
  ausente: { id: 'ausente', name: 'Estilista A', isDefault: false },
  libre: { id: 'libre', name: 'Estilista B', isDefault: false },
  def: { id: 'def', name: 'Por defecto', isDefault: true },
};

function montar(afectadas: Reservation[], elegir?: jest.Mock) {
  const repo = { findAffectedByAbsence: jest.fn(async () => afectadas) };
  const workers = {
    findWorker: jest.fn(async (id: string) => NOMBRES[id] ?? null),
  };
  const assigner = {
    elegir:
      elegir ??
      jest.fn(async (_s: Date, _e: Date, _tz: string, opts: any) => {
        // Una sola libre: se ocupa por las reasignaciones ya planeadas.
        const choca = (opts.ocupadas ?? []).some(
          (o: any) => o.workerId === 'libre' && o.start < _e && _s < o.end,
        );
        if (choca) throw new WorkerOverlapError();
        return 'libre';
      }),
  };
  const planner = new AbsencePlanner(
    repo as never,
    workers as never,
    assigner as never,
  );
  return { planner, repo, assigner };
}

describe('AbsencePlanner', () => {
  it('dos citas a las 10:00 y una sola libre: la primera se reasigna, la segunda se cancela', async () => {
    const { planner, assigner } = montar([
      cita('a', '10:00', 60, true),
      cita('b', '10:00', 60),
    ]);

    const plan = await planner.planear(ausencia(), NOW);

    expect(plan.workerName).toBe('Estilista A');
    expect(plan.impacts.map((i) => [i.reservationId, i.outcome])).toEqual([
      ['a', 'reasignada'],
      ['b', 'cancelada'],
    ]);
    expect(plan.impacts[0].newWorkerId).toBe('libre');
    expect(plan.impacts[0].newWorkerName).toBe('Estilista B');
    expect(plan.impacts[1].newWorkerId).toBeUndefined();
    expect(plan.impacts[0].services).toEqual(['Corte']);
    expect(plan.impacts[0].customerName).toBe('Clienta Prueba');
    expect(plan.impacts[0].customerPhone).toBe('+573001112233');
    const opts = (assigner.elegir as jest.Mock).mock.calls[0][3];
    expect(opts.excludeWorkerIds).toEqual(['ausente']);
    expect(opts.excludeReservationId).toBe('a');
  });

  it('una cita sin contacto se llama «Cliente registrado», como en los avisos', async () => {
    const sinContacto = Reservation.fromPersistence({
      id: 'sc',
      scheduledAt: utc('10:00'),
      endedAt: utc('11:00'),
      workerId: 'ausente',
      workerPinned: false,
      status: 'pendiente' as never,
      contact: null,
      lines: [
        { serviceId: 's1', name: 'Corte', price: 1, durationMinutes: 60 },
      ],
    } as never);
    const { planner } = montar([sinContacto]);

    const plan = await planner.planear(ausencia(), NOW);

    expect(plan.impacts[0].customerName).toBe('Cliente registrado');
  });

  it('pide al repositorio solo lo que empieza desde ahora y dentro de la franja', async () => {
    const { planner, repo } = montar([]);
    const a = ausencia('11:00', '12:00');

    const plan = await planner.planear(a, NOW);

    expect(plan.impacts).toEqual([]);
    expect(repo.findAffectedByAbsence).toHaveBeenCalledWith(
      'ausente',
      a.startsAt,
      a.endsAt,
      NOW,
    );
  });

  it('una cita 11:30-12:30 con ausencia hasta 12:00 aparece', async () => {
    const { planner } = montar([cita('x', '11:30', 60)]);

    const plan = await planner.planear(ausencia('11:00', '12:00'), NOW);

    expect(plan.impacts.map((i) => i.reservationId)).toEqual(['x']);
  });

  it('la estilista por defecto no puede ausentarse', async () => {
    const { planner } = montar([]);
    const a = WorkerAbsence.create({
      workerId: 'def',
      dateYmd: '2030-03-12',
      now: NOW,
      tz: TZ,
    });

    await expect(planner.planear(a, NOW)).rejects.toThrow(
      DefaultWorkerAbsenceError,
    );
  });

  it('una estilista que no existe lanza WorkerNotFoundError', async () => {
    const { planner } = montar([]);
    const a = WorkerAbsence.create({
      workerId: 'nadie',
      dateYmd: '2030-03-12',
      now: NOW,
      tz: TZ,
    });

    await expect(planner.planear(a, NOW)).rejects.toThrow(WorkerNotFoundError);
  });
});

import { Inject, Injectable } from '@nestjs/common';
import { ClockPort } from '../../domain/ports/clock.port';
import { WorkerAbsenceRepositoryPort } from '../../domain/ports/worker-absence-repository.port';
import { WorkerAvailabilityPort } from '../../domain/ports/worker-availability.port';
import { CLOCK, WORKER_ABSENCES, WORKER_AVAILABILITY } from '../tokens';

export interface AbsenceListItem {
  id: string;
  workerId: string;
  workerName: string;
  startsAt: Date;
  endsAt: Date;
}

/** Ausencias en curso o futuras, con el nombre de la estilista. */
@Injectable()
export class ListAbsencesUseCase {
  constructor(
    @Inject(WORKER_ABSENCES)
    private readonly absences: WorkerAbsenceRepositoryPort,
    @Inject(WORKER_AVAILABILITY)
    private readonly workers: WorkerAvailabilityPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<AbsenceListItem[]> {
    const filas = await this.absences.listUpcoming(this.clock.now());
    const ids = [...new Set(filas.map((a) => a.workerId))];
    const nombres = new Map(
      await Promise.all(
        ids.map(
          async (id) =>
            [id, (await this.workers.findWorker(id))?.name ?? ''] as const,
        ),
      ),
    );
    return filas.map((a) => ({
      id: a.id!,
      workerId: a.workerId,
      workerName: nombres.get(a.workerId) ?? '',
      startsAt: a.startsAt,
      endsAt: a.endsAt,
    }));
  }
}

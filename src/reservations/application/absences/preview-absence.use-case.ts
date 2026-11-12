import { Inject, Injectable } from '@nestjs/common';
import { AbsenceOverlapError } from '../../domain/errors';
import { ClockPort } from '../../domain/ports/clock.port';
import { WorkerAbsenceRepositoryPort } from '../../domain/ports/worker-absence-repository.port';
import { WorkerAbsence } from '../../domain/worker-absence';
import { CLOCK, WORKER_ABSENCES } from '../tokens';
import { AbsencePlan, AbsencePlanner } from './absence-planner';

export interface AbsenceCommand {
  workerId: string;
  dateYmd: string;
  from?: string;
  to?: string;
}

/**
 * Vista previa de una ausencia: qué pasaría con cada cita, sin guardar ni
 * avisar nada. Comprueba aquí el cruce con otras ausencias de la misma
 * estilista para que la dueña lo sepa antes de confirmar (al aplicar, lo
 * garantiza la restricción de exclusión).
 */
@Injectable()
export class PreviewAbsenceUseCase {
  constructor(
    @Inject(WORKER_ABSENCES)
    private readonly absences: WorkerAbsenceRepositoryPort,
    private readonly planner: AbsencePlanner,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(cmd: AbsenceCommand): Promise<AbsencePlan> {
    const now = this.clock.now();
    const absence = WorkerAbsence.create({
      ...cmd,
      now,
      tz: process.env.SALON_TZ ?? 'America/Bogota',
    });
    if (
      await this.absences.overlapsAny(
        absence.workerId,
        absence.startsAt,
        absence.endsAt,
      )
    ) {
      throw new AbsenceOverlapError();
    }
    return this.planner.planear(absence, now);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { AbsenceNotFoundError } from '../../domain/errors';
import { WorkerAbsenceRepositoryPort } from '../../domain/ports/worker-absence-repository.port';
import { WORKER_ABSENCES } from '../tokens';

/**
 * Quitar una ausencia solo reabre la agenda: las citas que se movieron o
 * cancelaron al aplicarla no se deshacen (la clienta ya fue avisada).
 */
@Injectable()
export class RemoveAbsenceUseCase {
  constructor(
    @Inject(WORKER_ABSENCES)
    private readonly absences: WorkerAbsenceRepositoryPort,
  ) {}

  async execute(id: string): Promise<void> {
    if (!(await this.absences.delete(id))) throw new AbsenceNotFoundError(id);
  }
}

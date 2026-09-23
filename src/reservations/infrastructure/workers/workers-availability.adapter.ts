import { Injectable } from '@nestjs/common';
import { WorkersService } from 'src/workers/workers.service';
import {
  AssignableWorkerLoad,
  WorkerAvailabilityPort,
} from '../../domain/ports/worker-availability.port';

@Injectable()
export class WorkersAvailabilityAdapter implements WorkerAvailabilityPort {
  constructor(private readonly workersService: WorkersService) {}

  countParallelStylists(): Promise<number> {
    return this.workersService.countParallelStylists();
  }

  async getDefaultWorkerId(): Promise<string> {
    return (await this.workersService.getDefaultWorker()).id;
  }

  /**
   * Se apoya en `getAvailabilityByDate`, que ya es la fuente de verdad de la
   * ocupación del portal y ya excluye las canceladas. Si hoy es el día, sus
   * `usedMinutes` cuentan solo la parte futura: para repartir carga eso es lo
   * correcto, porque lo que queda por hacer es lo que pesa.
   */
  async listAssignableWorkloads(
    dateYmd: string,
  ): Promise<AssignableWorkerLoad[]> {
    const { workers } =
      await this.workersService.getAvailabilityByDate(dateYmd);
    return workers
      .filter((w) => w.assignable)
      .map((w) => ({ id: w.id, usedMinutes: w.usedMinutes }));
  }
}

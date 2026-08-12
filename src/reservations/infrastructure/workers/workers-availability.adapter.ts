import { Injectable } from '@nestjs/common';
import { WorkersService } from 'src/workers/workers.service';
import { WorkerAvailabilityPort } from '../../domain/ports/worker-availability.port';

@Injectable()
export class WorkersAvailabilityAdapter implements WorkerAvailabilityPort {
  constructor(private readonly workersService: WorkersService) {}

  countParallelStylists(): Promise<number> {
    return this.workersService.countParallelStylists();
  }

  async getDefaultWorkerId(): Promise<string> {
    return (await this.workersService.getDefaultWorker()).id;
  }
}

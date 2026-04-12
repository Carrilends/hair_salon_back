import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from './entities/worker.entity';

const DEFAULT_WORKER_NAME = 'Estilista default';

@Injectable()
export class WorkersService implements OnModuleInit {
  constructor(
    @InjectRepository(Worker)
    private readonly workerRepository: Repository<Worker>,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultWorker();
  }

  async ensureDefaultWorker(): Promise<void> {
    const existing = await this.workerRepository.findOne({
      where: { isDefault: true },
    });
    if (existing) return;

    await this.workerRepository.save(
      this.workerRepository.create({
        name: DEFAULT_WORKER_NAME,
        isDefault: true,
      }),
    );
  }

  async getDefaultWorker(): Promise<Worker> {
    await this.ensureDefaultWorker();
    const worker = await this.workerRepository.findOne({
      where: { isDefault: true },
    });
    if (!worker) {
      throw new InternalServerErrorException('Default worker not found');
    }
    return worker;
  }

  /**
   * Estilistas en paralelo (excluye el worker default).
   * Si no hay ninguno, usa `SALON_PARALLEL_STYLISTS_FALLBACK` (default 3).
   */
  async countParallelStylists(): Promise<number> {
    await this.ensureDefaultWorker();
    const n = await this.workerRepository.count({
      where: { isDefault: false },
    });
    if (n > 0) return n;
    const raw = process.env.SALON_PARALLEL_STYLISTS_FALLBACK ?? '3';
    const fallback = Number.parseInt(raw, 10);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 3;
  }
}

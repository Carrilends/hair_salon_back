import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationScheduling } from '../domain/reservation-scheduling';
import { WorkerOverlapError } from '../domain/errors';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { WorkerAvailabilityPort } from '../domain/ports/worker-availability.port';
import { RESERVATION_REPOSITORY, WORKER_AVAILABILITY } from './tokens';

export interface CreateReservationCommand {
  scheduledAt: string;
  totalDurationMinutes: number;
  workerId?: string;
}

@Injectable()
export class CreateReservationUseCase {
  private readonly scheduling = new ReservationScheduling();

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(WORKER_AVAILABILITY)
    private readonly workers: WorkerAvailabilityPort,
  ) {}

  async execute(command: CreateReservationCommand): Promise<Reservation> {
    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const workerId =
      command.workerId ?? (await this.workers.getDefaultWorkerId());

    const reservation = Reservation.schedule({
      scheduledAt: new Date(command.scheduledAt),
      totalDurationMinutes: command.totalDurationMinutes,
      workerId,
    });

    this.scheduling.assertWithinBusinessHours(reservation, tz);

    const overlaps = await this.repository.countOverlaps(
      workerId,
      reservation.scheduledAt,
      reservation.endedAt,
    );
    if (overlaps > 0) throw new WorkerOverlapError();

    return this.repository.save(reservation);
  }
}

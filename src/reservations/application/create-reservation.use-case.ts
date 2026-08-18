import { Inject, Injectable } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationScheduling } from '../domain/reservation-scheduling';
import { WorkerOverlapError, InvalidReservationError } from '../domain/errors';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { WorkerAvailabilityPort } from '../domain/ports/worker-availability.port';
import { ServiceCatalogPort } from '../domain/ports/service-catalog.port';
import { ClockPort } from '../domain/ports/clock.port';
import {
  RESERVATION_REPOSITORY,
  WORKER_AVAILABILITY,
  SERVICE_CATALOG,
  CLOCK,
} from './tokens';

export interface CreateReservationCommand {
  scheduledAt: string;
  serviceIds: string[];
  workerId?: string;
  userId?: string | null;
  contact?: { name: string; phone: string; email?: string | null } | null;
}

@Injectable()
export class CreateReservationUseCase {
  private readonly scheduling = new ReservationScheduling();

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(WORKER_AVAILABILITY)
    private readonly workers: WorkerAvailabilityPort,
    @Inject(SERVICE_CATALOG)
    private readonly catalog: ServiceCatalogPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
  ) {}

  async execute(command: CreateReservationCommand): Promise<Reservation> {
    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const workerId =
      command.workerId ?? (await this.workers.getDefaultWorkerId());

    const snapshots = await this.catalog.getSnapshots(command.serviceIds);
    if (snapshots.length !== command.serviceIds.length) {
      throw new InvalidReservationError('Uno o más servicios no existen');
    }
    const lines = snapshots.map((s) => ({
      serviceId: s.id,
      name: s.name,
      price: s.price,
      durationMinutes: s.durationMinutes,
    }));

    const reservation = Reservation.schedule({
      scheduledAt: new Date(command.scheduledAt),
      workerId,
      lines,
      userId: command.userId ?? null,
      contact: command.contact ?? null,
    });

    this.scheduling.assertWithinBusinessHours(reservation, tz);
    this.scheduling.assertNotInThePast(reservation, this.clock.now());

    const overlaps = await this.repository.countOverlaps(
      workerId,
      reservation.scheduledAt,
      reservation.endedAt,
    );
    if (overlaps > 0) throw new WorkerOverlapError();

    return this.repository.save(reservation);
  }
}

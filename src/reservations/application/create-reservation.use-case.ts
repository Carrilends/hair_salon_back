import { Inject, Injectable, Logger } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationScheduling } from '../domain/reservation-scheduling';
import {
  WorkerOverlapError,
  InvalidReservationError,
  DuplicateServicesError,
} from '../domain/errors';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { WorkerAvailabilityPort } from '../domain/ports/worker-availability.port';
import { ServiceCatalogPort } from '../domain/ports/service-catalog.port';
import { ClockPort } from '../domain/ports/clock.port';
import { ReservationNotifierPort } from '../domain/ports/reservation-notifier.port';
import {
  RESERVATION_REPOSITORY,
  WORKER_AVAILABILITY,
  SERVICE_CATALOG,
  CLOCK,
  RESERVATION_NOTIFIER,
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
  private readonly logger = new Logger(CreateReservationUseCase.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(WORKER_AVAILABILITY)
    private readonly workers: WorkerAvailabilityPort,
    @Inject(SERVICE_CATALOG)
    private readonly catalog: ServiceCatalogPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
    @Inject(RESERVATION_NOTIFIER)
    private readonly notifier: ReservationNotifierPort,
  ) {}

  async execute(command: CreateReservationCommand): Promise<Reservation> {
    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const workerId =
      command.workerId ?? (await this.workers.getDefaultWorkerId());

    // Se rechazan los duplicados ANTES de consultar el catálogo: `In(ids)`
    // colapsa repetidos, así que una lista con duplicados daría un falso
    // "servicio no existe" por descuadre de longitudes. La validación explícita
    // devuelve el error correcto (400) en su lugar.
    const uniqueIds = new Set(command.serviceIds);
    if (uniqueIds.size !== command.serviceIds.length) {
      throw new DuplicateServicesError();
    }

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

    const saved = await this.repository.save(reservation);

    // Se notifica DESPUÉS de persistir: si la persistencia falla no hay nada que
    // anunciar; si falla la notificación, la reserva ya es un hecho (N8) y el
    // error no debe propagarse al cliente. El canal durable es la base de datos.
    try {
      await this.notifier.reservationCreated(saved);
    } catch (error) {
      this.logger.error(
        `Reserva ${saved.id} creada, pero falló la notificación`,
        error as Error,
      );
    }

    return saved;
  }
}

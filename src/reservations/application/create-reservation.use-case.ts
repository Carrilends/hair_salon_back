import { Inject, Injectable, Logger } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationScheduling } from '../domain/reservation-scheduling';
import {
  WorkerOverlapError,
  InvalidReservationError,
  DuplicateServicesError,
} from '../domain/errors';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { WorkerAssigner } from './worker-assigner';
import { ServiceCatalogPort } from '../domain/ports/service-catalog.port';
import { ClockPort } from '../domain/ports/clock.port';
import { ReservationNotifierPort } from '../domain/ports/reservation-notifier.port';
import {
  RESERVATION_REPOSITORY,
  SERVICE_CATALOG,
  CLOCK,
  RESERVATION_NOTIFIER,
} from './tokens';

/**
 * Marcador para el estilista todavía sin decidir. Nunca sale de `execute`: solo
 * existe mientras se valida el horario, que no depende de quién atienda.
 */
const ESTILISTA_POR_DECIDIR = '';

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
    private readonly assigner: WorkerAssigner,
    @Inject(SERVICE_CATALOG)
    private readonly catalog: ServiceCatalogPort,
    @Inject(CLOCK)
    private readonly clock: ClockPort,
    @Inject(RESERVATION_NOTIFIER)
    private readonly notifier: ReservationNotifierPort,
  ) {}

  async execute(command: CreateReservationCommand): Promise<Reservation> {
    const tz = process.env.SALON_TZ ?? 'America/Bogota';

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

    // El origen de la asignación se decide aquí y solo aquí: este es el único
    // punto del sistema que ve si el `workerId` llegó de fuera (la clienta lo
    // eligió en el portal) o va a decidirlo el reparto interno. Un adaptador no
    // puede saberlo —le llega un mandato ya armado— y por eso ninguno lo fija.
    const laEligioLaClienta = command.workerId != null;

    const armar = (workerId: string) =>
      Reservation.schedule({
        scheduledAt: new Date(command.scheduledAt),
        workerId,
        workerPinned: laEligioLaClienta,
        lines,
        userId: command.userId ?? null,
        contact: command.contact ?? null,
      });

    // Orden canónico (A6): primero lo que no depende del agregado, luego el
    // agregado, luego el mundo. El horario y el pasado no dependen de quién
    // atienda, así que se deciden sobre un borrador ANTES de ir a la base a
    // buscar estilista: una petición a las 22:00 debe decir «está cerrado», no
    // «no hay disponibilidad». Como `workerId` es inmutable en el agregado, se
    // reconstruye con el definitivo; construirlo es puro y barato.
    const borrador = armar(command.workerId ?? ESTILISTA_POR_DECIDIR);
    this.scheduling.assertWithinBusinessHours(borrador, tz);
    this.scheduling.assertNotInThePast(borrador, this.clock.now());

    const workerId =
      command.workerId ??
      (await this.assigner.elegir(borrador.scheduledAt, borrador.endedAt, tz));
    const reservation =
      workerId === borrador.workerId ? borrador : armar(workerId);

    // Única puerta del sistema para la regla de solape, la recorran las reservas
    // con estilista elegido o asignado. (La restricción de exclusión de la tabla
    // es el respaldo contra la carrera entre esta consulta y el INSERT.)
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

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
import { getDatePartsInTz } from '../salon-time';
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

/**
 * Marcador para el estilista todavía sin decidir. Nunca sale de `execute`: solo
 * existe mientras se valida el horario, que no depende de quién atienda.
 */
const ESTILISTA_POR_DECIDIR = '';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

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

    const armar = (workerId: string) =>
      Reservation.schedule({
        scheduledAt: new Date(command.scheduledAt),
        workerId,
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
      (await this.elegirEstilista(borrador.scheduledAt, borrador.endedAt, tz));
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

  /**
   * Elige la estilista que atenderá una reserva que no pidió ninguna.
   *
   * **Por qué existe.** La restricción de exclusión de `reservations` es *por
   * estilista* (`worker_id WITH =, tstzrange(...) WITH &&`). Mandar al
   * pseudo-estilista por defecto todo lo que llega sin `workerId` dejaba al
   * salón con capacidad efectiva 1: Postgres rechazaba la segunda cita
   * simultánea aunque hubiera sillas libres. Llegan aquí sin `workerId` el chat
   * (RF57/RF58 no hablan de estilistas) y el portal cuando la clienta marca
   * «Sin preferencia». La clienta sigue sin elegir: el reparto es interno.
   *
   * **Reparto.** Entre las libres, la que menos minutos tenga ocupados ese día.
   * No es una optimización sino equidad: sin criterio, el orden de la consulta
   * cargaría siempre a la primera. El desempate por `id` hace la elección
   * determinista y, por tanto, comprobable.
   *
   * **Si ninguna está libre** se rechaza igual que antes (409 por solape). No
   * hay cola ni sobrecupo: el salón no puede atender más de lo que puede.
   *
   * **Si no hay estilistas asignables dadas de alta** se conserva el
   * comportamiento anterior —el estilista por defecto—, que es lo único
   * posible; es también el caso del salón recién instalado.
   */
  private async elegirEstilista(
    scheduledAt: Date,
    endedAt: Date,
    tz: string,
  ): Promise<string> {
    const p = getDatePartsInTz(scheduledAt, tz);
    const dateYmd = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;

    const cargas = await this.workers.listAssignableWorkloads(dateYmd);
    if (cargas.length === 0) return this.workers.getDefaultWorkerId();

    const candidatas = [...cargas].sort(
      (a, b) => a.usedMinutes - b.usedMinutes || a.id.localeCompare(b.id),
    );

    // En serie y no en paralelo a propósito: en cuanto una sirve, las demás
    // consultas sobran, y son pocas (el salón tiene un puñado de estilistas).
    for (const candidata of candidatas) {
      const solapes = await this.repository.countOverlaps(
        candidata.id,
        scheduledAt,
        endedAt,
      );
      if (solapes === 0) return candidata.id;
    }

    throw new WorkerOverlapError();
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Reservation } from '../../domain/reservation';
import { ReservationNotifierPort } from '../../domain/ports/reservation-notifier.port';
import { NotificationDispatcher } from 'src/notifications/application/notification-dispatcher';
import { WorkersService } from 'src/workers/workers.service';
import { ServiceImagesPort } from '../../domain/ports/service-images.port';
import { SERVICE_IMAGES } from '../../application/tokens';
import { pickNotificationImage } from './notification-image';

/**
 * Traduce el lenguaje de Reservas ("una reserva fue creada") al del módulo de
 * notificaciones (un `ReservationCreatedEvent` en datos planos) y lo entrega al
 * despachador. Es el punto donde se resuelve el nombre del estilista, para no
 * ensuciar el puerto de disponibilidad con esa responsabilidad (N7).
 */
@Injectable()
export class ReservationNotifierAdapter implements ReservationNotifierPort {
  private readonly logger = new Logger(ReservationNotifierAdapter.name);

  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly workers: WorkersService,
    @Inject(SERVICE_IMAGES) private readonly images: ServiceImagesPort,
  ) {}

  async reservationCreated(reservation: Reservation): Promise<void> {
    // En paralelo: la creación espera a los avisos, y estas dos consultas no
    // dependen una de otra.
    const [base, imageUrl] = await Promise.all([
      this.baseEvent(reservation),
      this.imagenDelAviso(reservation),
    ]);
    await this.dispatcher.notify({
      type: 'reservation.created',
      ...base,
      ...(imageUrl ? { imageUrl } : {}),
    });
  }

  async reservationCancelled(
    reservation: Reservation,
    meta: { byAdmin: boolean },
  ): Promise<void> {
    await this.dispatcher.notify({
      type: 'reservation.cancelled',
      byAdmin: meta.byAdmin,
      ...(await this.baseEvent(reservation)),
    });
  }

  async reservationRescheduled(
    reservation: Reservation,
    meta: {
      byAdmin: boolean;
      previousScheduledAt: Date;
      workerChanged: boolean;
    },
  ): Promise<void> {
    await this.dispatcher.notify({
      type: 'reservation.rescheduled',
      byAdmin: meta.byAdmin,
      previousScheduledAt: meta.previousScheduledAt,
      // Viaja tal cual: quién decide qué hacer con él es cada canal. El nombre
      // de la estilista nueva ya va en `workerName` (lo resuelve `baseEvent`).
      workerChanged: meta.workerChanged,
      // La reserva ya viene movida: `scheduledAt` es la hora nueva, y la
      // anterior llega aparte para poder mostrar «antes → después».
      ...(await this.baseEvent(reservation)),
    });
  }

  async reservationConfirmed(reservation: Reservation): Promise<void> {
    await this.dispatcher.notify({
      type: 'reservation.confirmed',
      ...(await this.baseEvent(reservation)),
    });
  }

  /**
   * Foto para la cabecera del aviso (plan 06, F1). Un fallo aquí no puede
   * costar el aviso entero, y menos la reserva (NF11): se registra y el aviso
   * sale sin foto del servicio.
   */
  private async imagenDelAviso(
    reservation: Reservation,
  ): Promise<string | undefined> {
    const serviceIds = reservation.lines.map((l) => l.serviceId);
    try {
      const imagenes = await this.images.findImageUrls(
        serviceIds.filter((id): id is string => id !== null),
      );
      return pickNotificationImage(serviceIds, imagenes);
    } catch (err) {
      this.logger.warn(
        `No se pudo leer la foto del aviso de la reserva ${reservation.id}: ${(err as Error).message}`,
      );
      return undefined;
    }
  }

  /** Campos comunes a los cuatro eventos; resuelve el nombre del estilista (N7). */
  private async baseEvent(reservation: Reservation) {
    const workerName = await this.workers.getWorkerName(reservation.workerId);
    return {
      reservationId: reservation.id!,
      scheduledAt: reservation.scheduledAt,
      endedAt: reservation.endedAt,
      workerName,
      customerName: reservation.contact?.name ?? 'Cliente registrado',
      customerPhone: reservation.contact?.phone ?? null,
      services: reservation.lines.map((l) => ({
        name: l.name,
        price: l.price,
        durationMinutes: l.durationMinutes,
      })),
      totalDurationMinutes: reservation.totalDurationMinutes,
      totalPrice: reservation.lines.reduce((sum, l) => sum + l.price, 0),
      status: reservation.status,
    };
  }
}

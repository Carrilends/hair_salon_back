import { Injectable } from '@nestjs/common';
import { Reservation } from '../../domain/reservation';
import { ReservationNotifierPort } from '../../domain/ports/reservation-notifier.port';
import { NotificationDispatcher } from 'src/notifications/application/notification-dispatcher';
import { WorkersService } from 'src/workers/workers.service';

/**
 * Traduce el lenguaje de Reservas ("una reserva fue creada") al del módulo de
 * notificaciones (un `ReservationCreatedEvent` en datos planos) y lo entrega al
 * despachador. Es el punto donde se resuelve el nombre del estilista, para no
 * ensuciar el puerto de disponibilidad con esa responsabilidad (N7).
 */
@Injectable()
export class ReservationNotifierAdapter implements ReservationNotifierPort {
  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly workers: WorkersService,
  ) {}

  async reservationCreated(reservation: Reservation): Promise<void> {
    await this.dispatcher.notify({
      type: 'reservation.created',
      ...(await this.baseEvent(reservation)),
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
    meta: { byAdmin: boolean; previousScheduledAt: Date },
  ): Promise<void> {
    await this.dispatcher.notify({
      type: 'reservation.rescheduled',
      byAdmin: meta.byAdmin,
      previousScheduledAt: meta.previousScheduledAt,
      // La reserva ya viene movida: `scheduledAt` es la hora nueva, y la
      // anterior llega aparte para poder mostrar «antes → después».
      ...(await this.baseEvent(reservation)),
    });
  }

  /** Campos comunes a los tres eventos; resuelve el nombre del estilista (N7). */
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

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Reservation } from '../domain/reservation';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { ReservationNotifierPort } from '../domain/ports/reservation-notifier.port';
import { ReservationNotFoundError } from '../domain/errors';
import { RESERVATION_REPOSITORY, RESERVATION_NOTIFIER } from './tokens';

/**
 * Confirmar es siempre acción de la peluquería. Este caso de uso **no comprueba
 * actor**: su autorización vive en los bordes —`@Auth(admin)` en HTTP y la
 * comparación con `SALON_OWNER_WHATSAPP` en el canal de WhatsApp—. Cualquier
 * borde nuevo que lo exponga tiene que poner la suya.
 */
@Injectable()
export class ConfirmReservationUseCase {
  private readonly logger = new Logger(ConfirmReservationUseCase.name);

  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(RESERVATION_NOTIFIER)
    private readonly notifier: ReservationNotifierPort,
  ) {}

  async execute(id: string): Promise<Reservation> {
    const reservation = await this.repository.findById(id);
    if (!reservation) throw new ReservationNotFoundError(id);
    reservation.confirm();
    const saved = await this.repository.save(reservation);

    // Después de persistir y con el fallo aislado, como los otros tres: la
    // confirmación ya es un hecho y un canal caído no puede deshacerla.
    try {
      await this.notifier.reservationConfirmed(saved);
    } catch (error) {
      this.logger.error(
        `Reserva ${saved.id} confirmada, pero falló la notificación`,
        error as Error,
      );
    }

    return saved;
  }
}

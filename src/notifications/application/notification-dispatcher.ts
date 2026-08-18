import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotifierPort } from '../domain/ports/notifier.port';
import { NotifiableEvent } from '../domain/events/reservation-created.event';
import { NOTIFIERS } from './tokens';

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(@Inject(NOTIFIERS) private readonly notifiers: NotifierPort[]) {}

  /**
   * Nunca lanza (N8). Un canal caído no puede tumbar a los demás ni, mucho
   * menos, revertir la reserva que ya está persistida. Los fallos se registran
   * para poder auditarlos; el canal realmente durable es la base de datos.
   */
  async notify(event: NotifiableEvent): Promise<void> {
    const results = await Promise.allSettled(
      this.notifiers.map((notifier) => notifier.notify(event)),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const channel = this.notifiers[index]?.channel ?? 'desconocido';
        this.logger.error(
          `Fallo notificando ${event.type} (${event.reservationId}) por ${channel}`,
          result.reason,
        );
      }
    });
  }
}

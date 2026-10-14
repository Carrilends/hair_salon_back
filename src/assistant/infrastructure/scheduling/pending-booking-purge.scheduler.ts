import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PendingBookingRepositoryPort } from '../../domain/ports/pending-booking-repository.port';
import { PENDING_BOOKINGS } from '../../application/tokens';

/** Un día de margen: una propuesta vencida ya no sirve, pero ayuda a diagnosticar. */
const MARGEN_MS = 24 * 60 * 60 * 1000;

/**
 * Purga diaria de las propuestas de reserva vencidas (plan 06, F4). Llevan un
 * nombre y un número: no se guardan más de lo necesario.
 */
@Injectable()
export class PendingBookingPurgeScheduler {
  private readonly logger = new Logger(PendingBookingPurgeScheduler.name);

  constructor(
    @Inject(PENDING_BOOKINGS)
    private readonly pendientes: PendingBookingRepositoryPort,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handlePurge(): Promise<void> {
    const borradas = await this.pendientes.purgeExpiredBefore(
      new Date(Date.now() - MARGEN_MS),
    );
    if (borradas > 0) {
      this.logger.log(`Propuestas de reserva vencidas borradas: ${borradas}`);
    }
  }
}

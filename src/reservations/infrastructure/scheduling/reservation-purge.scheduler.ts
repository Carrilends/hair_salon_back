import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PurgeOldReservationsUseCase } from '../../application/purge-old-reservations.use-case';
import { SettlePastReservationsUseCase } from '../../application/settle-past-reservations.use-case';

/**
 * Adaptadores primarios de tiempo del bounded context Reservas:
 *   - cada hora: salda las reservas cuya ventana ya terminó (confirmada→cumplida,
 *     pendiente→cancelada) (§6.4);
 *   - a diario: purga físicamente las reservas antiguas.
 */
@Injectable()
export class ReservationPurgeScheduler {
  constructor(
    private readonly purge: PurgeOldReservationsUseCase,
    private readonly settle: SettlePastReservationsUseCase,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  handleSettlePastReservations() {
    return this.settle.execute();
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  handlePurge() {
    return this.purge.execute();
  }
}

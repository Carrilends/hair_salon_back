import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PurgeOldReservationsUseCase } from '../../application/purge-old-reservations.use-case';
import { MarkPastReservationsFulfilledUseCase } from '../../application/mark-past-reservations-fulfilled.use-case';

/**
 * Adaptadores primarios de tiempo del bounded context Reservas:
 *   - cada hora: marca `cumplida` las reservas cuya ventana ya terminó (§6.4);
 *   - a diario: purga físicamente las reservas antiguas.
 */
@Injectable()
export class ReservationPurgeScheduler {
  constructor(
    private readonly purge: PurgeOldReservationsUseCase,
    private readonly markFulfilled: MarkPastReservationsFulfilledUseCase,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  handleMarkFulfilled() {
    return this.markFulfilled.execute();
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  handlePurge() {
    return this.purge.execute();
  }
}

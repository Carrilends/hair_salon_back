import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PurgeOldReservationsUseCase } from '../../application/purge-old-reservations.use-case';

/**
 * Adaptador primario de infraestructura: dispara la purga diaria de reservas
 * antiguas invocando el caso de uso. Reemplaza al @Cron que vivía dentro del
 * servicio monolítico.
 */
@Injectable()
export class ReservationPurgeScheduler {
  constructor(private readonly purge: PurgeOldReservationsUseCase) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  handle() {
    return this.purge.execute();
  }
}

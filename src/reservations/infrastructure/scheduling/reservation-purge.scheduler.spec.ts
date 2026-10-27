import { CronExpression } from '@nestjs/schedule';
import { SCHEDULE_CRON_OPTIONS } from '@nestjs/schedule/dist/schedule.constants';
import { ReservationPurgeScheduler } from './reservation-purge.scheduler';

describe('ReservationPurgeScheduler', () => {
  const cron = (method: keyof ReservationPurgeScheduler) =>
    Reflect.getMetadata(
      SCHEDULE_CRON_OPTIONS,
      ReservationPurgeScheduler.prototype[method],
    );

  it('la limpieza diaria corre a las 4:00 y el cierre cada hora', () => {
    expect(cron('handlePurge').cronTime).toBe('0 04 * * *');
    expect(cron('handleSettlePastReservations').cronTime).toBe(
      CronExpression.EVERY_HOUR,
    );
  });
});

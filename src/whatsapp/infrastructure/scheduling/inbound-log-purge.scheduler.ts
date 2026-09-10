import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InboundMessageLogPort } from '../../domain/ports/inbound-message-log.port';
import { INBOUND_MESSAGE_LOG, RATE_LIMITER } from '../../application/tokens';
import { InboundRateLimiter } from '../../application/rate-limiter';

/** Días que se conserva la bitácora de entrantes. */
const DIAS_DE_RETENCION = 30;

/**
 * Adaptador primario de tiempo del canal. Molde del de Reservas: clase delgada,
 * sin lógica propia, que solo llama a quien sabe hacer el trabajo.
 *
 * La bitácora de idempotencia solo tiene que cubrir la ventana de reintentos de
 * Meta (días, no meses); conservarla más sería acumular teléfonos sin motivo,
 * que además son datos personales.
 */
@Injectable()
export class InboundLogPurgeScheduler {
  constructor(
    @Inject(INBOUND_MESSAGE_LOG)
    private readonly log: InboundMessageLogPort,
    @Inject(RATE_LIMITER)
    private readonly limiter: InboundRateLimiter,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  handlePurge(): Promise<void> {
    const corte = new Date(Date.now() - DIAS_DE_RETENCION * 86400000);
    return this.log.deleteOlderThan(corte);
  }

  /** El mapa del limitador solo crece con números nuevos; se poda a menudo. */
  @Cron(CronExpression.EVERY_HOUR)
  handlePrune(): void {
    this.limiter.prune();
  }
}

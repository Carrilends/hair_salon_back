import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlidingWindowRateLimiter } from 'src/common/rate-limit/sliding-window-rate-limiter';
import { ASSISTANT_IP_LIMITER } from '../../application/tokens';

/**
 * Adaptador primario de tiempo del asistente. Clase delgada, sin lógica propia,
 * igual que el del canal de WhatsApp.
 *
 * El mapa del limitador solo crece con orígenes distintos, y en un proceso de
 * larga vida eso es una fuga lenta. Podarlo con la misma cadencia que la
 * ventana basta: nada sobrevive más de dos ventanas.
 */
@Injectable()
export class IpLimiterPruneScheduler {
  constructor(
    @Inject(ASSISTANT_IP_LIMITER)
    private readonly limiter: SlidingWindowRateLimiter,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  handlePrune(): void {
    this.limiter.prune();
  }
}

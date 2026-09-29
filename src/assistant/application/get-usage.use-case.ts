import { Inject, Injectable } from '@nestjs/common';
import {
  AssistantUsage,
  ConversationRepositoryPort,
} from '../domain/ports/conversation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { AssistantBudget } from './assistant-budget';
import { inicioDelDiaDelSalon } from './salon-day';
import {
  ASSISTANT_BUDGET,
  ASSISTANT_CLOCK,
  CONVERSATION_REPOSITORY,
} from './tokens';

/** Lo que la peluquería necesita saber para responder «¿cuánto llevamos hoy?». */
export interface AssistantUsageReport {
  /** Medianoche del día del salón, en UTC. */
  desde: string;
  hoy: AssistantUsage;
  /** `null` si la instalación no puso techo. */
  techoDiarioTokens: number | null;
  /** `null` si no hay techo; nunca negativo. */
  restanteTokens: number | null;
}

/**
 * Consulta de administración del gasto del día.
 *
 * Sin esto, el techo diario sería un interruptor a ciegas: no habría forma de
 * saber si se está cerca de saltar, ni de calibrarlo con datos en vez de con
 * una corazonada. Es también el único sitio donde el ahorro del prompt caching
 * se ve, ahora que `cached_tokens` se persiste.
 */
@Injectable()
export class GetAssistantUsageUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly repository: ConversationRepositoryPort,
    @Inject(ASSISTANT_CLOCK) private readonly clock: ClockPort,
    @Inject(ASSISTANT_BUDGET) private readonly budget: AssistantBudget,
  ) {}

  async execute(): Promise<AssistantUsageReport> {
    const desde = inicioDelDiaDelSalon(this.clock.now());
    const hoy = await this.repository.usageSince(desde);
    const techo =
      this.budget.maxTokensPerDay > 0 ? this.budget.maxTokensPerDay : null;

    return {
      desde: desde.toISOString(),
      hoy,
      techoDiarioTokens: techo,
      restanteTokens:
        techo === null ? null : Math.max(0, techo - hoy.totalTokens),
    };
  }
}

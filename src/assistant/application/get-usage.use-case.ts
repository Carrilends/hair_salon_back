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
  ASSISTANT_JUDGMENT_TELEMETRY,
  CONVERSATION_REPOSITORY,
} from './tokens';
import { InformeDeJuicios, TelemetriaDeJuicios } from './judgment-telemetry';

/** Lo que la peluquería necesita saber para responder «¿cuánto llevamos hoy?». */
export interface AssistantUsageReport {
  /** Medianoche del día del salón, en UTC. */
  desde: string;
  hoy: AssistantUsage;
  /** `null` si la instalación no puso techo. */
  techoDiarioTokens: number | null;
  /** `null` si no hay techo; nunca negativo. */
  restanteTokens: number | null;
  /**
   * Telemetría del juicio diferido y del bucle (plan 04, T8), o `null` si no
   * hay ninguna montada. Sale por aquí y no por un sitio propio porque **una
   * telemetría sin lector es coste puro**: este es el informe que la peluquería
   * ya consulta para calibrar el techo. Se reinicia con cada despliegue, igual
   * que el libro del gasto del día y por la misma razón.
   */
  juicios: InformeDeJuicios | null;
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
    @Inject(ASSISTANT_JUDGMENT_TELEMETRY)
    private readonly telemetria?: TelemetriaDeJuicios,
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
      juicios: this.telemetria?.informe() ?? null,
    };
  }
}

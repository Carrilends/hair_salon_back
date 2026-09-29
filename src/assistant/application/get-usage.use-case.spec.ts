import { GetAssistantUsageUseCase } from './get-usage.use-case';
import { AssistantBudget } from './assistant-budget';
import {
  AssistantUsage,
  ConversationRepositoryPort,
} from '../domain/ports/conversation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';

const GASTO: AssistantUsage = {
  promptTokens: 1200,
  completionTokens: 340,
  cachedTokens: 900,
  totalTokens: 1540,
  mensajes: 14,
  conversaciones: 3,
};

class FakeRepo implements Partial<ConversationRepositoryPort> {
  ventanaPedida?: Date;
  constructor(private readonly gasto: AssistantUsage = GASTO) {}
  async usageSince(since: Date): Promise<AssistantUsage> {
    this.ventanaPedida = since;
    return this.gasto;
  }
}

// 14:00 UTC del 19/08/2026 son las 09:00 en Bogotá: el día del salón empezó a
// las 05:00 UTC.
const clock: ClockPort = { now: () => new Date('2026-08-19T14:00:00Z') };
const PRESUPUESTO: AssistantBudget = {
  maxMessagesPerConversation: 20,
  maxMessagesPerUserPerDay: 50,
  maxTokensPerDay: 2000,
};

function sut(opts: { repo?: FakeRepo; budget?: AssistantBudget } = {}) {
  const repo = opts.repo ?? new FakeRepo();
  return {
    repo,
    useCase: new GetAssistantUsageUseCase(
      repo as never,
      clock,
      opts.budget ?? PRESUPUESTO,
    ),
  };
}

describe('GetAssistantUsageUseCase', () => {
  it('informa del gasto del día del salón, no de las últimas 24 horas', async () => {
    const { useCase, repo } = sut();

    const informe = await useCase.execute();

    expect(repo.ventanaPedida!.toISOString()).toBe('2026-08-19T05:00:00.000Z');
    expect(informe.desde).toBe('2026-08-19T05:00:00.000Z');
    expect(informe.hoy).toEqual(GASTO);
  });

  it('dice cuánto queda contra el techo', async () => {
    const { useCase } = sut();

    const informe = await useCase.execute();

    expect(informe.techoDiarioTokens).toBe(2000);
    expect(informe.restanteTokens).toBe(460);
  });

  it('lo que queda nunca es negativo', async () => {
    const { useCase } = sut({
      budget: { ...PRESUPUESTO, maxTokensPerDay: 1000 },
    });

    const informe = await useCase.execute();

    expect(informe.restanteTokens).toBe(0);
  });

  it('sin techo configurado no inventa uno', async () => {
    const { useCase } = sut({ budget: { ...PRESUPUESTO, maxTokensPerDay: 0 } });

    const informe = await useCase.execute();

    expect(informe.techoDiarioTokens).toBeNull();
    expect(informe.restanteTokens).toBeNull();
  });
});

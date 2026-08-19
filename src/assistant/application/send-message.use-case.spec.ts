import { SendMessageUseCase } from './send-message.use-case';
import { ConversationSummarizer } from './summarize-conversation.use-case';
import { AssistantBudget } from './assistant-budget';
import { FakeLlmAdapter } from '../infrastructure/llm/fake-llm.adapter';
import { Conversation } from '../domain/conversation';
import { Message } from '../domain/message';
import { TokenUsage } from '../domain/token-usage';
import { BudgetExceededError } from '../domain/errors';
import { AssistantTool } from './tools/assistant-tool';
import { LlmCompletion, LlmToolDefinition } from '../domain/ports/llm.port';
import { ConversationRepositoryPort } from '../domain/ports/conversation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';

class FakeTool implements AssistantTool {
  calls = 0;
  readonly definition: LlmToolDefinition;
  constructor(
    readonly name: string,
    private readonly result: unknown,
  ) {
    this.definition = {
      name,
      description: 'x',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    };
  }
  async execute(): Promise<unknown> {
    this.calls++;
    return this.result;
  }
}

class FakeRepo implements ConversationRepositoryPort {
  saved?: Conversation;
  constructor(private readonly existing: Conversation | null = null) {}
  async findById(): Promise<Conversation | null> {
    return this.existing;
  }
  async save(c: Conversation): Promise<Conversation> {
    this.saved = c;
    return c;
  }
  async countMessagesOfUserSince(): Promise<number> {
    return 0;
  }
}

class FakeSummarizer implements ConversationSummarizer {
  calls = 0;
  async execute(): Promise<{ summary: string; usage: TokenUsage }> {
    this.calls++;
    return { summary: 'resumen generado', usage: TokenUsage.zero() };
  }
}

const clock: ClockPort = { now: () => new Date('2026-08-19T14:00:00Z') };
const DEFAULT_BUDGET: AssistantBudget = {
  maxMessagesPerConversation: 20,
  maxMessagesPerUserPerDay: 50,
};

function makeUseCase(opts: {
  llm: FakeLlmAdapter;
  repo: ConversationRepositoryPort;
  tools?: AssistantTool[];
  budget?: AssistantBudget;
  summarizer?: ConversationSummarizer;
}): SendMessageUseCase {
  return new SendMessageUseCase(
    opts.llm,
    opts.repo,
    opts.tools ?? [],
    clock,
    opts.budget ?? DEFAULT_BUDGET,
    opts.summarizer ?? new FakeSummarizer(),
  );
}

describe('SendMessageUseCase', () => {
  it('encadena herramienta y respuesta final, acumulando el consumo', async () => {
    const tool = new FakeTool('listarServicios', [
      { id: 's1', nombre: 'Corte' },
    ]);
    const llm = new FakeLlmAdapter([
      {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 't1',
              name: 'listarServicios',
              arguments: { busqueda: 'corte' },
            },
          ],
        },
        usage: TokenUsage.of(120, 20),
      },
      {
        message: { role: 'assistant', content: 'Tenemos Corte por $20.000.' },
        usage: TokenUsage.of(180, 40),
      },
    ]);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    const res = await useCase.execute({
      message: 'quiero un corte',
      userId: 'u1',
    });

    expect(res.reply).toBe('Tenemos Corte por $20.000.');
    expect(tool.calls).toBe(1);
    expect(llm.calls).toHaveLength(2);
    expect(repo.saved!.usage.promptTokens).toBe(300);
    expect(repo.saved!.usage.completionTokens).toBe(60);
  });

  it('corta a las 5 vueltas si el modelo insiste en llamar herramientas', async () => {
    const tool = new FakeTool('listarServicios', []);
    const script: LlmCompletion[] = Array.from({ length: 6 }, () => ({
      message: {
        role: 'assistant' as const,
        content: '',
        toolCalls: [{ id: 't', name: 'listarServicios', arguments: {} }],
      },
      usage: TokenUsage.of(10, 5),
    }));
    const llm = new FakeLlmAdapter(script);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    const res = await useCase.execute({ message: 'hola', userId: 'u1' });

    expect(llm.calls).toHaveLength(5);
    expect(tool.calls).toBe(5);
    expect(res.reply.length).toBeGreaterThan(0);
  });

  it('rechaza el turno cuando se agotó el presupuesto, sin llamar al LLM', async () => {
    const conversation = Conversation.start({ userId: 'u1' });
    for (let i = 0; i < 20; i++) conversation.append(Message.user(`m${i}`));
    const llm = new FakeLlmAdapter([]);
    const repo = new FakeRepo(conversation);
    const useCase = makeUseCase({ llm, repo });

    await expect(
      useCase.execute({ conversationId: 'c1', message: 'otra', userId: 'u1' }),
    ).rejects.toThrow(BudgetExceededError);
    expect(llm.calls).toHaveLength(0);
  });

  it('solo envía system + resumen + ventana de 8 + el mensaje nuevo', async () => {
    const conversation = Conversation.start({ userId: 'u1' });
    for (let i = 0; i < 30; i++)
      conversation.append(Message.user(`mensaje ${i}`));
    conversation.setSummary('resumen previo');
    const llm = new FakeLlmAdapter([
      {
        message: { role: 'assistant', content: 'Hola, ¿en qué te ayudo?' },
        usage: TokenUsage.of(90, 15),
      },
    ]);
    const repo = new FakeRepo(conversation);
    const useCase = makeUseCase({
      llm,
      repo,
      budget: {
        maxMessagesPerConversation: 100,
        maxMessagesPerUserPerDay: 100,
      },
    });

    await useCase.execute({
      conversationId: 'c1',
      message: 'hola',
      userId: 'u1',
    });

    const sent = llm.calls[0].messages;
    expect(sent).toHaveLength(11);
    expect(sent[0].role).toBe('system');
    expect(sent[1].content).toContain('resumen previo');
    expect(sent[2].content).toBe('mensaje 22');
    expect(sent[9].content).toBe('mensaje 29');
    expect(sent[10].content).toBe('hola');
  });
});

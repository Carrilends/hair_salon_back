import { SendMessageUseCase } from './send-message.use-case';
import { ConversationSummarizer } from './summarize-conversation.use-case';
import { AssistantBudget } from './assistant-budget';
import { FakeLlmAdapter } from '../infrastructure/llm/fake-llm.adapter';
import { Conversation } from '../domain/conversation';
import { Message } from '../domain/message';
import { TokenUsage } from '../domain/token-usage';
import { BudgetExceededError, ConversationAccessError } from '../domain/errors';
import { AssistantContext, AssistantTool } from './tools/assistant-tool';
import { LlmCompletion, LlmToolDefinition } from '../domain/ports/llm.port';
import { ConversationRepositoryPort } from '../domain/ports/conversation-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { SYSTEM_PROMPT } from './system-prompt';

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

/** Herramienta que captura el contexto recibido, para verificar qué le llega. */
class ContextCapturingTool implements AssistantTool {
  lastContext?: AssistantContext;
  readonly definition: LlmToolDefinition;
  constructor(readonly name: string) {
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
  async execute(
    _args: Record<string, unknown>,
    context: AssistantContext,
  ): Promise<unknown> {
    this.lastContext = context;
    return { ok: true };
  }
}

/** Herramienta "presentable": su resultado se surfacea como propuesta estructurada. */
class FakePresentableTool implements AssistantTool {
  readonly presentable = true;
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
    return this.result;
  }
}

class FakeRepo implements ConversationRepositoryPort {
  saved?: Conversation;
  constructor(
    private readonly existing: Conversation | null = null,
    private readonly dailyCount = 0,
  ) {}
  async findById(): Promise<Conversation | null> {
    return this.existing;
  }
  async save(c: Conversation): Promise<Conversation> {
    this.saved = c;
    return c;
  }
  async countMessagesOfUserSince(): Promise<number> {
    return this.dailyCount;
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

  it('propaga isAdmin del input al contexto que reciben las herramientas', async () => {
    // Regla de seguridad de la Fase 6: el rol admin sale del solicitante
    // autenticado (JWT), no de la conversación. El bucle debe trasladarlo al
    // contexto para que `cancelarReserva` lo consume.
    const tool = new ContextCapturingTool('marca');
    const llm = new FakeLlmAdapter([
      {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 't1', name: 'marca', arguments: {} }],
        },
        usage: TokenUsage.of(10, 5),
      },
      {
        message: { role: 'assistant', content: 'Listo.' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    await useCase.execute({
      message: 'cancela mi reserva',
      userId: 'admin-1',
      isAdmin: true,
    });

    expect(tool.lastContext?.isAdmin).toBe(true);
    expect(tool.lastContext?.userId).toBe('admin-1');
  });

  it('sin isAdmin en el input, el contexto lo recibe como false (mínimo privilegio)', async () => {
    const tool = new ContextCapturingTool('marca');
    const llm = new FakeLlmAdapter([
      {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 't1', name: 'marca', arguments: {} }],
        },
        usage: TokenUsage.of(10, 5),
      },
      {
        message: { role: 'assistant', content: 'Listo.' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    await useCase.execute({ message: 'hola', userId: 'u1' });

    expect(tool.lastContext?.isAdmin).toBe(false);
  });

  it('surfacea la propuesta de una herramienta presentable en el resultado', async () => {
    const propuesta = {
      evento: 'boda',
      lineas: [{ serviceId: 'r1' }],
      total: 60000,
    };
    const tool = new FakePresentableTool('componerPaquete', propuesta);
    const llm = new FakeLlmAdapter([
      {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 't1', name: 'componerPaquete', arguments: {} }],
        },
        usage: TokenUsage.of(10, 5),
      },
      {
        message: { role: 'assistant', content: 'Aquí tienes tu paquete.' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    const res = await useCase.execute({ message: 'me caso', userId: 'u1' });

    expect(res.propuesta).toEqual(propuesta);
  });

  it('no surfacea propuesta si la herramienta presentable devuelve un error', async () => {
    const tool = new FakePresentableTool('componerPaquete', {
      ok: false,
      motivo: 'evento_no_disponible',
    });
    const llm = new FakeLlmAdapter([
      {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 't1', name: 'componerPaquete', arguments: {} }],
        },
        usage: TokenUsage.of(10, 5),
      },
      {
        message: { role: 'assistant', content: 'Ese evento no está.' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    const res = await useCase.execute({ message: 'me gradúo', userId: 'u1' });

    expect(res.propuesta).toBeUndefined();
  });

  it('no surfacea propuesta si el turno acaba en respuesta de cortesía', async () => {
    // La herramienta compone (propuesta set) pero el modelo insiste con llamadas
    // hasta agotar las vueltas: la respuesta es de cortesía y NO debe llegar con
    // la tarjeta del paquete (sería un mensaje contradictorio).
    const tool = new FakePresentableTool('componerPaquete', {
      evento: 'boda',
      lineas: [{ serviceId: 'r1' }],
    });
    const script: LlmCompletion[] = Array.from({ length: 6 }, () => ({
      message: {
        role: 'assistant' as const,
        content: '',
        toolCalls: [{ id: 't', name: 'componerPaquete', arguments: {} }],
      },
      usage: TokenUsage.of(10, 5),
    }));
    const llm = new FakeLlmAdapter(script);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    const res = await useCase.execute({ message: 'me caso', userId: 'u1' });

    expect(res.reply.length).toBeGreaterThan(0);
    expect(res.propuesta).toBeUndefined();
  });

  it('no surfacea propuesta de herramientas no presentables', async () => {
    const tool = new FakeTool('listarServicios', [{ id: 's1' }]);
    const llm = new FakeLlmAdapter([
      {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 't1', name: 'listarServicios', arguments: {} }],
        },
        usage: TokenUsage.of(10, 5),
      },
      {
        message: { role: 'assistant', content: 'Tenemos varios.' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    const res = await useCase.execute({ message: 'servicios', userId: 'u1' });

    expect(res.propuesta).toBeUndefined();
  });

  it('corta a las 5 vueltas y NO ejecuta la herramienta en la última (evita escritura fantasma)', async () => {
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

    // 5 llamadas al LLM, pero la herramienta solo se ejecuta en las 4 primeras:
    // en la 5.ª vuelta no habría llamada posterior que consuma su resultado, así
    // que ejecutarla causaría un efecto (p. ej. una reserva real) sin poder
    // informar a la clienta. Se corta con cortesía sin ejecutar.
    expect(llm.calls).toHaveLength(5);
    expect(tool.calls).toBe(4);
    expect(res.reply.length).toBeGreaterThan(0);
  });

  it('rechaza cuando el usuario supera su presupuesto diario, sin llamar al LLM', async () => {
    const llm = new FakeLlmAdapter([]);
    const repo = new FakeRepo(null, 50);
    const useCase = makeUseCase({
      llm,
      repo,
      budget: { maxMessagesPerConversation: 20, maxMessagesPerUserPerDay: 50 },
    });

    await expect(
      useCase.execute({ message: 'otra', userId: 'u1' }),
    ).rejects.toThrow(BudgetExceededError);
    expect(llm.calls).toHaveLength(0);
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

  it('rechaza reanudar la conversación de otro usuario, sin llamar al LLM', async () => {
    const ajena = Conversation.start({ userId: 'A' });
    const llm = new FakeLlmAdapter([]);
    const repo = new FakeRepo(ajena);
    const useCase = makeUseCase({ llm, repo });

    await expect(
      useCase.execute({ conversationId: 'c1', message: 'hola', userId: 'B' }),
    ).rejects.toThrow(ConversationAccessError);
    expect(llm.calls).toHaveLength(0);
  });

  it('permite reanudar una conversación anónima tras iniciar sesión', async () => {
    const anon = Conversation.start({ userId: null });
    const llm = new FakeLlmAdapter([
      {
        message: { role: 'assistant', content: 'Hola' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const repo = new FakeRepo(anon);
    const useCase = makeUseCase({ llm, repo });

    const res = await useCase.execute({
      conversationId: 'c1',
      message: 'hola',
      userId: 'B',
    });
    expect(res.reply).toBe('Hola');
  });

  it('solo envía system + fecha + resumen + ventana de 8 + el mensaje nuevo', async () => {
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
    // prefijo + fecha de hoy + resumen + ventana de 8 + el mensaje nuevo.
    expect(sent).toHaveLength(12);
    expect(sent[0].role).toBe('system');
    expect(sent[1].content).toContain('Hoy es');
    expect(sent[2].content).toContain('resumen previo');
    expect(sent[3].content).toBe('mensaje 22');
    expect(sent[10].content).toBe('mensaje 29');
    expect(sent[11].content).toBe('hola');
  });

  it('le dice al modelo qué día es hoy, después del prefijo cacheable', async () => {
    const llm = new FakeLlmAdapter([
      {
        message: { role: 'assistant', content: 'ok' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const useCase = makeUseCase({ llm, repo: new FakeRepo(null) });

    await useCase.execute({ message: '¿hay espacio mañana?', userId: 'u1' });

    const messages = llm.calls[0].messages;
    // El prefijo constante va PRIMERO: es lo que el proveedor cachea (§6.2).
    // La fecha cambia cada día, así que viaja después para no invalidarlo.
    expect(messages[0].content).toBe(SYSTEM_PROMPT);
    // Sin esto el asistente no entiende "mañana" ni "el viernes", que es como
    // pide cita la gente (verificado contra la API real el 2026-09-08).
    expect(messages[1].role).toBe('system');
    expect(messages[1].content).toContain('2026-08-19');
  });
});

import { SendMessageUseCase } from './send-message.use-case';
import { ConversationSummarizer } from './summarize-conversation.use-case';
import { AssistantBudget } from './assistant-budget';
import { DailyTokenLedger } from './daily-token-ledger';
import { FakeLlmAdapter } from '../infrastructure/llm/fake-llm.adapter';
import { Conversation } from '../domain/conversation';
import { Message } from '../domain/message';
import { TokenUsage } from '../domain/token-usage';
import { BudgetExceededError, ConversationAccessError } from '../domain/errors';
import { AssistantContext, AssistantTool } from './tools/assistant-tool';
import { AssistantPresentation } from './tools/assistant-presentation';
import { LlmCompletion, LlmToolDefinition } from '../domain/ports/llm.port';
import {
  AssistantUsage,
  ConversationRepositoryPort,
} from '../domain/ports/conversation-repository.port';
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

/**
 * Herramienta que presenta: además de devolverle datos al modelo, produce el
 * dato tipado que el widget pinta. Imita a las de verdad —devuelve `null`
 * cuando el resultado es un error— para que la regla de descarte se pruebe
 * donde vive, que es en la herramienta.
 */
class FakePresentingTool implements AssistantTool {
  readonly definition: LlmToolDefinition;
  constructor(
    readonly name: string,
    private readonly result: unknown,
    private readonly tipo: 'paquete' | 'servicios' = 'paquete',
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
  presentar(result: unknown): AssistantPresentation | null {
    if (typeof result !== 'object' || result === null) return null;
    if ((result as { ok?: unknown }).ok === false) return null;
    return { tipo: this.tipo, ...result } as AssistantPresentation;
  }
}

class FakeRepo implements ConversationRepositoryPort {
  saved?: Conversation;
  /** Gasto agregado del día que devuelve `sumTokensSince`. */
  gastoDelDia = 0;
  /** Si está puesto, `sumTokensSince` falla con él (para probar el fallo cerrado). */
  falloDelContador?: Error;
  ventanaPedida?: Date;
  constructor(
    private readonly existing: Conversation | null = null,
    private readonly dailyCount = 0,
  ) {}
  vecesConsultadoElGasto = 0;
  async sumTokensSince(since: Date): Promise<number> {
    this.ventanaPedida = since;
    this.vecesConsultadoElGasto++;
    if (this.falloDelContador) throw this.falloDelContador;
    return this.gastoDelDia;
  }
  async usageSince(): Promise<AssistantUsage> {
    return {
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
      mensajes: 0,
      conversaciones: 0,
    };
  }
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
  constructor(private readonly usage: TokenUsage = TokenUsage.zero()) {}
  async execute(): Promise<{ summary: string; usage: TokenUsage }> {
    this.calls++;
    return { summary: 'resumen generado', usage: this.usage };
  }
}

const clock: ClockPort = { now: () => new Date('2026-08-19T14:00:00Z') };
/** Reserva pequeña en pruebas: así los números del techo se leen a simple vista. */
const RESERVA_POR_TURNO_EN_PRUEBAS = 1;
const DEFAULT_BUDGET: AssistantBudget = {
  maxMessagesPerConversation: 20,
  maxMessagesPerUserPerDay: 50,
  // 0 = sin techo de instalación: las pruebas que no lo miran no lo sufren.
  maxTokensPerDay: 0,
};

function makeUseCase(opts: {
  llm: FakeLlmAdapter;
  repo: ConversationRepositoryPort;
  tools?: AssistantTool[];
  budget?: AssistantBudget;
  summarizer?: ConversationSummarizer;
  ledger?: DailyTokenLedger;
  clock?: ClockPort;
}): SendMessageUseCase {
  return new SendMessageUseCase(
    opts.llm,
    opts.repo,
    opts.tools ?? [],
    opts.clock ?? clock,
    opts.budget ?? DEFAULT_BUDGET,
    opts.summarizer ?? new FakeSummarizer(),
    // Libro nuevo por caso de uso: el estado del día no se filtra entre pruebas.
    opts.ledger ?? new DailyTokenLedger(RESERVA_POR_TURNO_EN_PRUEBAS),
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

  it('imputa al mensaje del asistente el consumo del turno ENTERO, no el de la última vuelta', async () => {
    // Las columnas `prompt_tokens`/`completion_tokens` de `assistant_messages`
    // existían desde la Fase 5 y estaban vacías en el 100 % de las filas: sin
    // ellas, un abuso no se puede ni investigar después. Se imputa la suma de
    // todas las llamadas del turno porque las vueltas de herramienta también se
    // pagan; quedarse con la última escondería el grueso del coste.
    const tool = new FakeTool('listarServicios', [{ id: 's1' }]);
    const llm = new FakeLlmAdapter([
      {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 't1', name: 'listarServicios', arguments: {} }],
        },
        usage: TokenUsage.of(120, 20),
      },
      {
        message: { role: 'assistant', content: 'Tenemos Corte.' },
        usage: TokenUsage.of(180, 40),
      },
    ]);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    await useCase.execute({ message: 'quiero un corte', userId: 'u1' });

    const guardados = repo.saved!.messages;
    const respuesta = guardados[guardados.length - 1];
    expect(respuesta.role).toBe('assistant');
    expect(respuesta.usage!.promptTokens).toBe(300);
    expect(respuesta.usage!.completionTokens).toBe(60);
  });

  it('el mensaje de la clienta no lleva consumo imputado: lo paga la respuesta', async () => {
    const llm = new FakeLlmAdapter([
      {
        message: { role: 'assistant', content: 'Hola.' },
        usage: TokenUsage.of(50, 10),
      },
    ]);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo });

    await useCase.execute({ message: 'hola', userId: null });

    const [pregunta, respuesta] = repo.saved!.messages;
    expect(pregunta.role).toBe('user');
    expect(pregunta.usage).toBeNull();
    expect(respuesta.usage!.total).toBe(60);
  });

  it('imputa también el turno que se corta por cortesía al agotar las vueltas', async () => {
    // Agotar las cinco vueltas es el turno MÁS caro que existe; si ése fuera el
    // que se guarda sin consumo, la auditoría mentiría justo donde importa.
    const tool = new FakeTool('listarServicios', [{ id: 's1' }]);
    const vuelta = {
      message: {
        role: 'assistant' as const,
        content: '',
        toolCalls: [{ id: 't1', name: 'listarServicios', arguments: {} }],
      },
      usage: TokenUsage.of(100, 10),
    };
    const llm = new FakeLlmAdapter([vuelta, vuelta, vuelta, vuelta, vuelta]);
    const repo = new FakeRepo(null);
    const useCase = makeUseCase({ llm, repo, tools: [tool] });

    await useCase.execute({ message: 'dame vueltas', userId: 'u1' });

    const guardados = repo.saved!.messages;
    const respuesta = guardados[guardados.length - 1];
    expect(respuesta.usage!.promptTokens).toBe(500);
    expect(respuesta.usage!.completionTokens).toBe(50);
  });

  it('el coste del resumen se imputa al turno que lo provocó', async () => {
    // El resumidor manda al modelo el historial ENTERO, así que es la llamada
    // más cara de la conversación. Si su consumo se quedara solo en el total de
    // la conversación, ni el techo diario ni la consulta de gasto —que agregan
    // sobre los mensajes— lo verían, y la factura real sería mayor que la
    // medida justo en las conversaciones largas.
    const conversation = Conversation.start({ userId: 'u1' });
    // Con ocho mensajes previos, los dos de este turno completan diez y disparan
    // el resumen.
    for (let i = 0; i < 8; i++) conversation.append(Message.user(`m${i}`));
    const llm = new FakeLlmAdapter([
      {
        message: { role: 'assistant', content: 'Hola.' },
        usage: TokenUsage.of(100, 20),
      },
    ]);
    const repo = new FakeRepo(conversation);
    const summarizer = new FakeSummarizer(TokenUsage.of(900, 80));
    const useCase = makeUseCase({ llm, repo, summarizer });

    await useCase.execute({
      conversationId: 'c1',
      message: 'hola',
      userId: 'u1',
    });

    expect(summarizer.calls).toBe(1);
    const guardados = repo.saved!.messages;
    const respuesta = guardados[guardados.length - 1];
    expect(respuesta.usage!.promptTokens).toBe(1000);
    expect(respuesta.usage!.completionTokens).toBe(100);
    // Y el total de la conversación no se cuenta dos veces.
    expect(repo.saved!.usage.promptTokens).toBe(1000);
  });

  describe('techo diario de la instalación', () => {
    function llmDeUnTurno(): FakeLlmAdapter {
      return new FakeLlmAdapter([
        {
          message: { role: 'assistant', content: 'Hola.' },
          usage: TokenUsage.of(50, 10),
        },
      ]);
    }

    it('superado el techo se responde con cortesía SIN llamar al proveedor', async () => {
      const llm = llmDeUnTurno();
      const repo = new FakeRepo(null);
      repo.gastoDelDia = 1500;
      const useCase = makeUseCase({
        llm,
        repo,
        budget: { ...DEFAULT_BUDGET, maxTokensPerDay: 1500 },
      });

      await expect(
        useCase.execute({ message: 'hola', userId: null }),
      ).rejects.toBeInstanceOf(BudgetExceededError);
      expect(llm.calls).toHaveLength(0);
    });

    it('por debajo del techo el turno sigue su curso', async () => {
      const llm = llmDeUnTurno();
      const repo = new FakeRepo(null);
      repo.gastoDelDia = 1499;
      const useCase = makeUseCase({
        llm,
        repo,
        budget: { ...DEFAULT_BUDGET, maxTokensPerDay: 1500 },
      });

      await expect(
        useCase.execute({ message: 'hola', userId: null }),
      ).resolves.toMatchObject({ reply: 'Hola.' });
    });

    it('con el techo en 0 no se consulta el gasto: la instalación no lo quiere', async () => {
      const llm = llmDeUnTurno();
      const repo = new FakeRepo(null);
      repo.gastoDelDia = 999_999;
      const useCase = makeUseCase({
        llm,
        repo,
        budget: { ...DEFAULT_BUDGET, maxTokensPerDay: 0 },
      });

      await useCase.execute({ message: 'hola', userId: null });

      expect(repo.ventanaPedida).toBeUndefined();
    });

    it('si el contador falla se rechaza: en el límite se falla CERRADO', async () => {
      // Criterio del plan 02: fallar cerrado en el límite, abierto en la
      // telemetría. Un contador caído no puede convertirse en barra libre.
      const llm = llmDeUnTurno();
      const repo = new FakeRepo(null);
      repo.falloDelContador = new Error('la base no responde');
      const useCase = makeUseCase({
        llm,
        repo,
        budget: { ...DEFAULT_BUDGET, maxTokensPerDay: 1500 },
      });

      await expect(
        useCase.execute({ message: 'hola', userId: null }),
      ).rejects.toBeInstanceOf(BudgetExceededError);
      expect(llm.calls).toHaveLength(0);
    });

    it('dos turnos SIMULTÁNEOS no comparten el último hueco', async () => {
      // El defecto: el gasto solo se escribe al terminar el turno, así que sin
      // reserva por adelantado las dos peticiones leían la misma cifra por
      // debajo del techo y las dos llamaban al proveedor. Con reservas de 1000
      // y 1000 de margen, solo cabe una.
      let soltarPrimera: (() => void) | undefined;
      const enVuelo = new Promise<void>((r) => (soltarPrimera = r));
      let llamadas = 0;
      const llm = {
        async complete() {
          llamadas++;
          await enVuelo;
          return {
            message: { role: 'assistant' as const, content: 'Hola.' },
            usage: TokenUsage.of(50, 10),
          };
        },
      };
      const repo = new FakeRepo(null);
      repo.gastoDelDia = 199_000;
      const useCase = makeUseCase({
        llm: llm as never,
        repo,
        budget: { ...DEFAULT_BUDGET, maxTokensPerDay: 200_000 },
        ledger: new DailyTokenLedger(1_000),
      });

      const primera = useCase.execute({ message: 'a', userId: null });
      const segunda = useCase
        .execute({ message: 'b', userId: null })
        .then(() => 'pasó')
        .catch((e: unknown) =>
          e instanceof BudgetExceededError ? 'rechazada' : 'otro error',
        );

      await expect(segunda).resolves.toBe('rechazada');
      soltarPrimera!();
      await primera;
      // La segunda ni siquiera llegó al proveedor.
      expect(llamadas).toBe(1);
    });

    it('la base se consulta una vez al día, no en cada turno', async () => {
      // Antes, cada petición —incluidas las que el techo iba a rechazar—
      // disparaba una agregación sobre `assistant_messages`. La red de
      // seguridad se convertía en un amplificador contra Postgres durante la
      // misma ráfaga que la activó.
      const repo = new FakeRepo(null);
      repo.gastoDelDia = 0;
      const useCase = makeUseCase({
        llm: new FakeLlmAdapter([
          {
            message: { role: 'assistant', content: 'Hola.' },
            usage: TokenUsage.of(50, 10),
          },
          {
            message: { role: 'assistant', content: 'Hola.' },
            usage: TokenUsage.of(50, 10),
          },
        ]),
        repo,
        budget: { ...DEFAULT_BUDGET, maxTokensPerDay: 200_000 },
      });

      await useCase.execute({ message: 'a', userId: null });
      await useCase.execute({ message: 'b', userId: null });

      expect(repo.vecesConsultadoElGasto).toBe(1);
    });

    it('el gasto del turno se descuenta aunque el turno acabe lanzando', async () => {
      // Los tokens ya gastados cuando el proveedor se cae no llegan a la base,
      // porque no se guarda nada. Si tampoco se anotaran en la cuenta del día,
      // serían gasto invisible: un proveedor inestable erosionaría el techo.
      const libro = new DailyTokenLedger(1_000);
      let vueltas = 0;
      const llm = {
        async complete() {
          vueltas++;
          if (vueltas === 2) throw new Error('el proveedor se cayó');
          return {
            message: {
              role: 'assistant' as const,
              content: '',
              toolCalls: [{ id: 't1', name: 'marca', arguments: {} }],
            },
            usage: TokenUsage.of(400, 100),
          };
        },
      };
      const repo = new FakeRepo(null);
      const useCase = makeUseCase({
        llm: llm as never,
        repo,
        tools: [new FakeTool('marca', { ok: true })],
        budget: { ...DEFAULT_BUDGET, maxTokensPerDay: 200_000 },
        ledger: libro,
      });

      await expect(
        useCase.execute({ message: 'hola', userId: null }),
      ).rejects.toThrow('el proveedor se cayó');

      expect(libro.gastoConocido).toBe(500);
    });

    it('la ventana es el día del salón, no las últimas 24 horas', async () => {
      // El reloj de las pruebas marca las 14:00 UTC del 19/08/2026, que en
      // Bogotá son las 09:00 del mismo día: el corte es la medianoche local,
      // las 05:00 UTC.
      const llm = llmDeUnTurno();
      const repo = new FakeRepo(null);
      const useCase = makeUseCase({
        llm,
        repo,
        budget: { ...DEFAULT_BUDGET, maxTokensPerDay: 1500 },
      });

      await useCase.execute({ message: 'hola', userId: null });

      expect(repo.ventanaPedida!.toISOString()).toBe(
        '2026-08-19T05:00:00.000Z',
      );
    });
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

  it('surfacea la presentación de una herramienta en el resultado', async () => {
    const propuesta = {
      evento: 'boda',
      lineas: [{ serviceId: 'r1' }],
      total: 60000,
    };
    const tool = new FakePresentingTool('componerPaquete', propuesta);
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

    expect(res.presentaciones).toEqual([{ tipo: 'paquete', ...propuesta }]);
  });

  it('no surfacea nada si la herramienta devuelve un error', async () => {
    const tool = new FakePresentingTool('componerPaquete', {
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

    expect(res.presentaciones).toBeUndefined();
  });

  it('no surfacea nada si el turno acaba en respuesta de cortesía', async () => {
    // La herramienta compone (propuesta set) pero el modelo insiste con llamadas
    // hasta agotar las vueltas: la respuesta es de cortesía y NO debe llegar con
    // la tarjeta del paquete (sería un mensaje contradictorio).
    const tool = new FakePresentingTool('componerPaquete', {
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
    expect(res.presentaciones).toBeUndefined();
  });

  it('no surfacea nada de herramientas que no presentan', async () => {
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

    expect(res.presentaciones).toBeUndefined();
  });

  it('surfacea TODAS las presentaciones del turno, en orden de llamada', async () => {
    // Antes ganaba la última y las demás se perdían: un turno que compone un
    // paquete y además lista servicios solo podía enseñar una cosa.
    const paquete = new FakePresentingTool(
      'componerPaquete',
      { evento: 'boda', total: 60000 },
      'paquete',
    );
    const listado = new FakePresentingTool(
      'listarServicios',
      { servicios: [{ id: 's1', nombre: 'Corte' }] },
      'servicios',
    );
    const llm = new FakeLlmAdapter([
      {
        message: {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 't1', name: 'componerPaquete', arguments: {} },
            { id: 't2', name: 'listarServicios', arguments: {} },
          ],
        },
        usage: TokenUsage.of(10, 5),
      },
      {
        message: { role: 'assistant', content: 'Aquí tienes.' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const useCase = makeUseCase({
      llm,
      repo: new FakeRepo(null),
      tools: [paquete, listado],
    });

    const res = await useCase.execute({ message: 'me caso', userId: 'u1' });

    expect(res.presentaciones).toEqual([
      { tipo: 'paquete', evento: 'boda', total: 60000 },
      { tipo: 'servicios', servicios: [{ id: 's1', nombre: 'Corte' }] },
    ]);
  });

  it('descarta la presentación repetida cuando el modelo repite la llamada', async () => {
    // El modelo reincide en la misma herramienta con los mismos argumentos más a
    // menudo de lo que parece. Dos tarjetas idénticas seguidas se ven como un
    // fallo, y lo son.
    const listado = new FakePresentingTool(
      'listarServicios',
      { servicios: [{ id: 's1' }] },
      'servicios',
    );
    const vuelta = {
      message: {
        role: 'assistant' as const,
        content: '',
        toolCalls: [{ id: 't', name: 'listarServicios', arguments: {} }],
      },
      usage: TokenUsage.of(10, 5),
    };
    const llm = new FakeLlmAdapter([
      vuelta,
      vuelta,
      {
        message: { role: 'assistant', content: 'Eso es todo.' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const useCase = makeUseCase({
      llm,
      repo: new FakeRepo(null),
      tools: [listado],
    });

    const res = await useCase.execute({ message: 'servicios', userId: 'u1' });

    expect(res.presentaciones).toEqual([
      { tipo: 'servicios', servicios: [{ id: 's1' }] },
    ]);
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
      budget: { ...DEFAULT_BUDGET, maxMessagesPerUserPerDay: 50 },
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

  it('al reanudarla con sesión, la conversación anónima pasa a ser de quien la reanuda', async () => {
    // Si no se reclamase, esa conversación se quedaría sin dueño para siempre y
    // sus mensajes no contarían contra el tope diario del usuario —que se cuenta
    // por dueño de la conversación—, mientras que el tope por origen tampoco se
    // le aplica por tener sesión. Sería la vía más barata para saltarse los dos.
    const anon = Conversation.start({ userId: null });
    const llm = new FakeLlmAdapter([
      {
        message: { role: 'assistant', content: 'Hola' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const repo = new FakeRepo(anon);
    const useCase = makeUseCase({ llm, repo });

    await useCase.execute({
      conversationId: 'c1',
      message: 'hola',
      userId: 'B',
    });

    expect(repo.saved!.userId).toBe('B');
  });

  it('una conversación anónima que sigue sin sesión no adquiere dueño', async () => {
    const anon = Conversation.start({ userId: null });
    const llm = new FakeLlmAdapter([
      {
        message: { role: 'assistant', content: 'Hola' },
        usage: TokenUsage.of(10, 5),
      },
    ]);
    const repo = new FakeRepo(anon);
    const useCase = makeUseCase({ llm, repo });

    await useCase.execute({
      conversationId: 'c1',
      message: 'hola',
      userId: null,
    });

    expect(repo.saved!.userId).toBeNull();
  });

  it('reclamada por su dueña, ya no la puede continuar un anónimo', async () => {
    const anon = Conversation.start({ userId: null });
    anon.claimBy('B');
    const llm = new FakeLlmAdapter([]);
    const repo = new FakeRepo(anon);
    const useCase = makeUseCase({ llm, repo });

    await expect(
      useCase.execute({ conversationId: 'c1', message: 'hola', userId: null }),
    ).rejects.toBeInstanceOf(ConversationAccessError);
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
        ...DEFAULT_BUDGET,
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

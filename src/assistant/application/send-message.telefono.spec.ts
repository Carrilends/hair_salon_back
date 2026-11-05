import { SendMessageUseCase } from './send-message.use-case';
import { AssistantBudget } from './assistant-budget';
import { DailyTokenLedger } from './daily-token-ledger';
import { FakeLlmAdapter } from '../infrastructure/llm/fake-llm.adapter';
import { Conversation } from '../domain/conversation';
import { Message } from '../domain/message';
import { TokenUsage } from '../domain/token-usage';
import { BudgetExceededError, ConversationAccessError } from '../domain/errors';
import { AssistantContext, AssistantTool } from './tools/assistant-tool';
import { LlmCompletion, LlmToolDefinition } from '../domain/ports/llm.port';
import {
  AssistantUsage,
  ConversationRepositoryPort,
} from '../domain/ports/conversation-repository.port';
import { PhoneConversationRepositoryPort } from '../domain/ports/phone-conversation-repository.port';
import { AssistantPresentation } from './tools/assistant-presentation';
import { ClockPort } from '../domain/ports/clock.port';

/**
 * Plan 06, F3a: el mismo bucle del asistente, con una identidad «teléfono»
 * (canal WhatsApp). Nadie lo usa todavía —el webhook se conecta en F5—; estas
 * pruebas fijan las reglas D1, D2 y D7 antes de que exista el adaptador.
 */

const AHORA = new Date('2026-10-13T15:00:00Z');
const UN_DIA_ANTES = new Date('2026-10-12T15:00:00Z');
const NUMERO = '573001234567';

const clock: ClockPort = { now: () => AHORA };

const PRESUPUESTO: AssistantBudget = {
  maxMessagesPerConversation: 20,
  maxMessagesPerUserPerDay: 50,
  maxMessagesPerPhonePerDay: 50,
  maxTokensPerDay: 0,
};

/** Repositorio de pruebas con los dos puertos, como el de TypeORM. */
class RepoDoble
  implements ConversationRepositoryPort, PhoneConversationRepositoryPort
{
  guardada?: Conversation;
  porId: Conversation | null = null;
  activaDelNumero: Conversation | null = null;
  mensajesDelNumeroHoy = 0;
  gastoDelDia = 0;
  pedidasPorNumero: { phone: string; since: Date }[] = [];
  conteosPorNumero: { phone: string; since: Date }[] = [];

  async findById(): Promise<Conversation | null> {
    return this.porId;
  }
  async save(c: Conversation): Promise<Conversation> {
    this.guardada = c;
    return c;
  }
  async countMessagesOfUserSince(): Promise<number> {
    return 0;
  }
  async sumTokensSince(): Promise<number> {
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
  async findActiveByPhone(
    phone: string,
    since: Date,
  ): Promise<Conversation | null> {
    this.pedidasPorNumero.push({ phone, since });
    return this.activaDelNumero;
  }
  async countMessagesOfPhoneSince(phone: string, since: Date): Promise<number> {
    this.conteosPorNumero.push({ phone, since });
    return this.mensajesDelNumeroHoy;
  }
}

class HerramientaEspia implements AssistantTool {
  readonly name = 'listarServicios';
  contexto?: AssistantContext;
  readonly definition: LlmToolDefinition = {
    name: 'listarServicios',
    description: 'x',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  };
  async execute(_a: Record<string, unknown>, c: AssistantContext) {
    this.contexto = c;
    return { ok: true };
  }
}

const respuesta = (texto: string): LlmCompletion => ({
  message: { role: 'assistant', content: texto },
  usage: TokenUsage.of(10, 5),
});

const llamaYResponde = (): LlmCompletion[] => [
  {
    message: {
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 't1', name: 'listarServicios', arguments: {} }],
    },
    usage: TokenUsage.of(10, 5),
  },
  respuesta('Tenemos cortes.'),
];

function montar(opts: {
  repo?: RepoDoble;
  guion?: LlmCompletion[];
  presupuesto?: AssistantBudget;
  sinPuertoDeTelefono?: boolean;
  herramienta?: HerramientaEspia;
}) {
  const repo = opts.repo ?? new RepoDoble();
  const llm = new FakeLlmAdapter(opts.guion ?? [respuesta('Hola.')]);
  const herramienta = opts.herramienta ?? new HerramientaEspia();
  const useCase = new SendMessageUseCase(
    llm,
    repo,
    [herramienta],
    clock,
    opts.presupuesto ?? PRESUPUESTO,
    {
      execute: async () => ({ summary: 'r', usage: TokenUsage.zero() }),
    },
    new DailyTokenLedger(1),
    undefined,
    undefined,
    undefined,
    opts.sinPuertoDeTelefono ? undefined : repo,
    // Desde F3b, WhatsApp exige sus juegos: aquí los dos con la herramienta
    // espía, que es lo único que estas pruebas observan.
    { clienta: [herramienta], duena: [herramienta] },
    // La dueña de estas pruebas (revisión de F3b: isAdmin exige su número).
    // Aquí es el mismo NUMERO: lo que se prueba son los topes, no quién es.
    NUMERO,
  );
  return { useCase, repo, llm, herramienta };
}

function conversacionDelNumero(mensajes: number): Conversation {
  const c = Conversation.fromPersistence({ id: 'c-wa', phoneE164: NUMERO });
  for (let i = 0; i < mensajes; i++) c.append(Message.user(`m${i}`));
  return c;
}

describe('SendMessageUseCase · canal WhatsApp (plan 06, F3a)', () => {
  describe('identidad (D1)', () => {
    it('el primer mensaje de un número abre una conversación a su nombre, sin usuario', async () => {
      const { useCase, repo } = montar({});

      await useCase.execute({
        canal: 'whatsapp',
        phoneE164: NUMERO,
        userId: null,
        message: 'hola',
      });

      expect(repo.guardada?.phoneE164).toBe(NUMERO);
      expect(repo.guardada?.userId).toBeNull();
    });

    it('las herramientas reciben el canal y el número en el contexto', async () => {
      const { useCase, herramienta } = montar({ guion: llamaYResponde() });

      await useCase.execute({
        canal: 'whatsapp',
        phoneE164: NUMERO,
        userId: null,
        message: 'qué cortes tienen',
      });

      expect(herramienta.contexto).toMatchObject({
        canal: 'whatsapp',
        phoneE164: NUMERO,
        userId: null,
        isAdmin: false,
      });
    });

    it('la web sigue igual: canal web y sin número en el contexto', async () => {
      const { useCase, herramienta } = montar({ guion: llamaYResponde() });

      await useCase.execute({ userId: 'u-1', message: 'qué cortes tienen' });

      expect(herramienta.contexto?.canal).toBe('web');
      expect(herramienta.contexto?.phoneE164).toBeUndefined();
    });

    it.each([
      [
        'WhatsApp sin número',
        { canal: 'whatsapp' as const, userId: null, message: 'x' },
      ],
      [
        'WhatsApp con un usuario (nunca se fabrica un userId desde un teléfono)',
        {
          canal: 'whatsapp' as const,
          phoneE164: NUMERO,
          userId: 'u-1',
          message: 'x',
        },
      ],
      [
        'WhatsApp con un id de conversación (se encuentra por número)',
        {
          canal: 'whatsapp' as const,
          phoneE164: NUMERO,
          userId: null,
          conversationId: 'c-1',
          message: 'x',
        },
      ],
      [
        'la web con un número',
        { phoneE164: NUMERO, userId: null, message: 'x' },
      ],
      [
        'un número con «+» (dos formas del mismo número serían dos identidades)',
        {
          canal: 'whatsapp' as const,
          phoneE164: '+573001234567',
          userId: null,
          message: 'x',
        },
      ],
      [
        'un número con espacios',
        {
          canal: 'whatsapp' as const,
          phoneE164: '57 300 123 4567',
          userId: null,
          message: 'x',
        },
      ],
    ])('rechaza una entrada incoherente: %s', async (_caso, entrada) => {
      const { useCase, llm, repo } = montar({});

      await expect(useCase.execute(entrada)).rejects.toThrow();
      expect(llm.calls).toHaveLength(0);
      expect(repo.guardada).toBeUndefined();
    });

    it('sin el puerto de teléfono cableado falla claro, sin llamar al modelo', async () => {
      const { useCase, llm } = montar({ sinPuertoDeTelefono: true });

      await expect(
        useCase.execute({
          canal: 'whatsapp',
          phoneE164: NUMERO,
          userId: null,
          message: 'hola',
        }),
      ).rejects.toThrow(/teléfono/);
      expect(llm.calls).toHaveLength(0);
    });
  });

  describe('conversación por número (D2)', () => {
    it('retoma la conversación activa del número en las últimas 24 h', async () => {
      const repo = new RepoDoble();
      repo.activaDelNumero = conversacionDelNumero(2);
      const { useCase } = montar({ repo });

      const res = await useCase.execute({
        canal: 'whatsapp',
        phoneE164: NUMERO,
        userId: null,
        message: 'sigo aquí',
      });

      expect(repo.pedidasPorNumero).toEqual([
        { phone: NUMERO, since: UN_DIA_ANTES },
      ]);
      expect(res.conversationId).toBe('c-wa');
      expect(repo.guardada?.messageCount).toBe(4);
    });

    it('una conversación de WhatsApp no se puede retomar desde la web', async () => {
      const repo = new RepoDoble();
      repo.porId = conversacionDelNumero(2);
      const { useCase, llm } = montar({ repo });

      await expect(
        useCase.execute({ conversationId: 'c-wa', userId: null, message: 'x' }),
      ).rejects.toBeInstanceOf(ConversationAccessError);
      expect(llm.calls).toHaveLength(0);
    });

    it('ni siquiera con sesión iniciada', async () => {
      const repo = new RepoDoble();
      repo.porId = conversacionDelNumero(2);
      const { useCase } = montar({ repo });

      await expect(
        useCase.execute({
          conversationId: 'c-wa',
          userId: 'u-1',
          message: 'x',
        }),
      ).rejects.toBeInstanceOf(ConversationAccessError);
    });
  });

  describe('límites (D7)', () => {
    it('la clienta tiene tope por número y día, contado en las últimas 24 h', async () => {
      const repo = new RepoDoble();
      repo.mensajesDelNumeroHoy = 50;
      const { useCase, llm } = montar({ repo });

      await expect(
        useCase.execute({
          canal: 'whatsapp',
          phoneE164: NUMERO,
          userId: null,
          message: 'otra',
        }),
      ).rejects.toBeInstanceOf(BudgetExceededError);
      expect(repo.conteosPorNumero).toEqual([
        { phone: NUMERO, since: UN_DIA_ANTES },
      ]);
      expect(llm.calls).toHaveLength(0);
    });

    it('por debajo del tope por número, pasa', async () => {
      const repo = new RepoDoble();
      repo.mensajesDelNumeroHoy = 49;
      const { useCase } = montar({ repo });

      await expect(
        useCase.execute({
          canal: 'whatsapp',
          phoneE164: NUMERO,
          userId: null,
          message: 'otra',
        }),
      ).resolves.toMatchObject({ reply: 'Hola.' });
    });

    it('sin tope propio por número, usa el de por usuario', async () => {
      const repo = new RepoDoble();
      repo.mensajesDelNumeroHoy = 3;
      const { useCase } = montar({
        repo,
        presupuesto: {
          maxMessagesPerConversation: 20,
          maxMessagesPerUserPerDay: 3,
          maxTokensPerDay: 0,
        },
      });

      await expect(
        useCase.execute({
          canal: 'whatsapp',
          phoneE164: NUMERO,
          userId: null,
          message: 'otra',
        }),
      ).rejects.toBeInstanceOf(BudgetExceededError);
    });

    it('una conversación llena NO bloquea a la clienta: se abre otra (revisión de F3a)', async () => {
      // Con bloqueo, la undécima vuelta la dejaba sin asistente 24 h —la
      // conversación solo se renueva tras un día de silencio— y el tope por
      // número no llegaba a actuar nunca. Rotando, el límite real es ése.
      const repo = new RepoDoble();
      repo.activaDelNumero = conversacionDelNumero(20);
      const { useCase } = montar({ repo });

      const res = await useCase.execute({
        canal: 'whatsapp',
        phoneE164: NUMERO,
        userId: null,
        message: 'otra',
      });

      expect(res.reply).toBe('Hola.');
      expect(repo.guardada).not.toBe(repo.activaDelNumero);
      expect(repo.guardada?.phoneE164).toBe(NUMERO);
      expect(repo.guardada?.messageCount).toBe(2);
    });

    it('la dueña tampoco se bloquea, y su conversación no crece sin fin', async () => {
      const repo = new RepoDoble();
      repo.activaDelNumero = conversacionDelNumero(20);
      repo.mensajesDelNumeroHoy = 500;
      const { useCase } = montar({ repo });

      await expect(
        useCase.execute({
          canal: 'whatsapp',
          phoneE164: NUMERO,
          userId: null,
          isAdmin: true,
          message: 'la agenda de hoy',
        }),
      ).resolves.toMatchObject({ reply: 'Hola.' });
      // Exenta del tope por número: ni se consulta.
      expect(repo.conteosPorNumero).toHaveLength(0);
      expect(repo.guardada?.messageCount).toBe(2);
    });

    it('la dueña sigue bajo el techo diario de tokens', async () => {
      const repo = new RepoDoble();
      repo.gastoDelDia = 1_000;
      const { useCase, llm } = montar({
        repo,
        presupuesto: { ...PRESUPUESTO, maxTokensPerDay: 1_000 },
      });

      await expect(
        useCase.execute({
          canal: 'whatsapp',
          phoneE164: NUMERO,
          userId: null,
          isAdmin: true,
          message: 'la agenda de hoy',
        }),
      ).rejects.toBeInstanceOf(BudgetExceededError);
      expect(llm.calls).toHaveLength(0);
    });

    it('en la web, administración sigue teniendo el tope por conversación', async () => {
      const repo = new RepoDoble();
      repo.porId = Conversation.fromPersistence({ id: 'c-web', userId: 'a-1' });
      for (let i = 0; i < 20; i++) repo.porId.append(Message.user(`m${i}`));
      const { useCase } = montar({ repo });

      await expect(
        useCase.execute({
          conversationId: 'c-web',
          userId: 'a-1',
          isAdmin: true,
          message: 'x',
        }),
      ).rejects.toBeInstanceOf(BudgetExceededError);
    });
  });
});

describe('SendMessageUseCase · conversación nueva (plan 06, F5, D10)', () => {
  it('el primer mensaje de un número dice que la conversación es nueva', async () => {
    const { useCase } = montar({});
    const r = await useCase.execute({
      canal: 'whatsapp',
      phoneE164: NUMERO,
      userId: null,
      message: 'hola',
    });
    expect(r.conversacionNueva).toBe(true);
  });

  it('seguir una conversación activa no es nueva', async () => {
    const repo = new RepoDoble();
    repo.activaDelNumero = conversacionDelNumero(2);
    const { useCase } = montar({ repo });
    const r = await useCase.execute({
      canal: 'whatsapp',
      phoneE164: NUMERO,
      userId: null,
      message: 'y el sábado?',
    });
    expect(r.conversacionNueva).toBe(false);
  });

  it('una conversación llena que rota cuenta como nueva', async () => {
    const repo = new RepoDoble();
    repo.activaDelNumero = conversacionDelNumero(
      PRESUPUESTO.maxMessagesPerConversation,
    );
    const { useCase } = montar({ repo });
    const r = await useCase.execute({
      canal: 'whatsapp',
      phoneE164: NUMERO,
      userId: null,
      message: 'hola otra vez',
    });
    expect(r.conversacionNueva).toBe(true);
  });

  it('la web no recibe el campo', async () => {
    const { useCase } = montar({});
    const r = await useCase.execute({ userId: 'u-1', message: 'hola' });
    expect(r).not.toHaveProperty('conversacionNueva');
  });
});

describe('SendMessageUseCase · servicios del turno (catálogo con imágenes)', () => {
  const FOTO = 'https://res.cloudinary.com/demo/image/upload/v1/corte.jpg';

  class HerramientaQuePresenta extends HerramientaEspia {
    contextos: AssistantContext[] = [];
    constructor(private readonly p: AssistantPresentation) {
      super();
    }
    async execute(a: Record<string, unknown>, c: AssistantContext) {
      this.contextos.push(c);
      return super.execute(a, c);
    }
    async presentar(): Promise<AssistantPresentation> {
      return this.p;
    }
  }
  const servicios: AssistantPresentation = {
    tipo: 'servicios',
    servicios: [
      { id: 's-1', nombre: 'Corte', precio: 35000, minutos: 45, imagen: FOTO },
      { id: 's-2', nombre: 'Tinte', precio: 90000, minutos: 120 },
    ],
  };
  const wa = { canal: 'whatsapp' as const, phoneE164: NUMERO, userId: null };

  it('WhatsApp: guarda en el historial qué servicios se enviaron, sin URL', async () => {
    const herramienta = new HerramientaQuePresenta(servicios);
    const { useCase, repo } = montar({ herramienta, guion: llamaYResponde() });
    await useCase.execute({ ...wa, message: 'cortes?' });
    const guardado = repo.guardada!.window(10).at(-1)!.content;
    expect(guardado).toContain(
      '[Se le enviaron aparte, con foto si la hay: 1. Corte',
    );
    expect(guardado).toContain('2. Tinte');
    expect(guardado).not.toContain('s-1');
    expect(guardado).not.toContain('http');
  });

  it('WhatsApp: el contexto del turno trae un Set nuevo en cada turno', async () => {
    const herramienta = new HerramientaQuePresenta(servicios);
    const { useCase } = montar({
      herramienta,
      guion: [...llamaYResponde(), ...llamaYResponde()],
    });
    await useCase.execute({ ...wa, message: 'uno' });
    await useCase.execute({ ...wa, message: 'dos' });
    const [a, b] = herramienta.contextos.map((c) => c.serviciosDelTurno);
    expect(a).toBeInstanceOf(Set);
    expect(b).toBeInstanceOf(Set);
    expect(a).not.toBe(b);
  });

  it('la imagen nunca llega al modelo', async () => {
    const herramienta = new HerramientaQuePresenta(servicios);
    const { useCase, llm, repo } = montar({
      herramienta,
      guion: llamaYResponde(),
    });
    await useCase.execute({ ...wa, message: 'cortes?' });
    const todo = JSON.stringify(llm.calls.flatMap((c) => c.messages));
    expect(todo).not.toContain('res.cloudinary.com');
    const guardado = repo.guardada!.window(10).at(-1)!.content;
    expect(guardado).not.toContain('res.cloudinary.com');
  });

  it('un turno que acaba en disculpa no anota servicios', async () => {
    const herramienta = new HerramientaQuePresenta(servicios);
    const vuelta = llamaYResponde()[0];
    // El modelo no deja de pedir herramientas con argumentos distintos.
    const guion = Array.from({ length: 8 }, (_, i) => ({
      ...vuelta,
      message: {
        ...vuelta.message,
        toolCalls: [{ id: `t${i}`, name: 'listarServicios', arguments: { i } }],
      },
    }));
    const { useCase, repo } = montar({ herramienta, guion });
    await useCase.execute({ ...wa, message: 'cortes?' });
    const guardado = repo.guardada!.window(10).at(-1)!.content;
    expect(guardado).not.toContain('Se le enviaron aparte');
  });

  it('la web no cambia: ni marca ni Set', async () => {
    const herramienta = new HerramientaQuePresenta(servicios);
    const { useCase, repo } = montar({ herramienta, guion: llamaYResponde() });
    await useCase.execute({ userId: 'u-1', message: 'cortes?' });
    expect(herramienta.contextos[0].serviciosDelTurno).toBeUndefined();
    const guardado = repo.guardada!.window(10).at(-1)!.content;
    expect(guardado).not.toContain('Se le enviaron aparte');
  });
});

describe('SendMessageUseCase · marcas del acotado (I2)', () => {
  const wa = { canal: 'whatsapp' as const, phoneE164: NUMERO, userId: null };
  const MARCA_ACOTAR = '[Se le preguntó para acotar: corte]';
  const MARCA_QUE_BUSCA = '[Se le preguntó qué busca]';

  /** Devuelve los resultados dados en orden; el último se repite. */
  class HerramientaConGuion extends HerramientaEspia {
    constructor(
      private readonly resultados: ({ ok: boolean } & Record<
        string,
        unknown
      >)[],
    ) {
      super();
    }
    async execute() {
      return this.resultados.length > 1
        ? this.resultados.shift()!
        : this.resultados[0];
    }
  }
  const demasiados = {
    ok: false,
    motivo: 'demasiados',
    pregunta: '¿Qué opción de corte te interesa: Fade, Bob?',
    opciones: ['Fade', 'Bob'],
    concepto: ['corte'],
  };
  const guardado = (repo: RepoDoble) =>
    repo.guardada!.window(10).at(-1)!.content;
  const sinFin = (): LlmCompletion[] =>
    Array.from({ length: 8 }, (_, i) => ({
      message: {
        role: 'assistant' as const,
        content: '',
        toolCalls: [{ id: `t${i}`, name: 'listarServicios', arguments: { i } }],
      },
      usage: TokenUsage.of(10, 5),
    }));

  it('«demasiados» anota el concepto aunque el modelo reescriba la pregunta', async () => {
    const { useCase, repo } = montar({
      herramienta: new HerramientaConGuion([demasiados]),
      guion: [llamaYResponde()[0], respuesta('¿Cuál prefieres?')],
    });
    await useCase.execute({ ...wa, message: 'un corte' });
    expect(guardado(repo)).toBe(`¿Cuál prefieres?\n\n${MARCA_ACOTAR}`);
  });

  it('«falta_concepto» anota que se preguntó, sin ningún texto de la clienta', async () => {
    const { useCase, repo } = montar({
      herramienta: new HerramientaConGuion([
        { ok: false, motivo: 'falta_concepto', pregunta: '¿Qué buscas?' },
      ]),
      guion: [llamaYResponde()[0], respuesta('¿Qué servicio buscas?')],
    });
    await useCase.execute({ ...wa, message: 'soy Ana, mi 3001234567' });
    const texto = guardado(repo);
    expect(texto).toBe(`¿Qué servicio buscas?\n\n${MARCA_QUE_BUSCA}`);
    expect(texto).not.toMatch(/Ana|3001234567/);
  });

  it('otro motivo no anota nada', async () => {
    const { useCase, repo } = montar({
      herramienta: new HerramientaConGuion([
        { ok: false, motivo: 'sin_pedirlo', pregunta: '¿Qué buscas?' },
      ]),
      guion: [llamaYResponde()[0], respuesta('¿Qué buscas?')],
    });
    await useCase.execute({ ...wa, message: 'hola' });
    expect(guardado(repo)).toBe('¿Qué buscas?');
  });

  it('el turno que acaba en disculpa no anota nada', async () => {
    const { useCase, repo } = montar({
      // Sin `pregunta`: el bucle no tiene nada que decir y se disculpa.
      herramienta: new HerramientaConGuion([
        { ok: false, motivo: 'demasiados', concepto: ['corte'] },
      ]),
      guion: sinFin(),
    });
    const r = await useCase.execute({ ...wa, message: 'un corte' });
    expect(r.reply).toMatch(/Disculpa/);
    expect(guardado(repo)).not.toContain('Se le preguntó');
  });

  it('si el turno se corta y sale la pregunta de acotar, sí se le preguntó', async () => {
    const { useCase, repo } = montar({
      herramienta: new HerramientaConGuion([demasiados]),
      guion: sinFin(),
    });
    const r = await useCase.execute({ ...wa, message: 'un corte' });
    expect(r.reply).toBe(demasiados.pregunta);
    expect(guardado(repo)).toContain(MARCA_ACOTAR);
  });

  it('si el turno se corta y sale OTRA pregunta, la de acotar no se hizo', async () => {
    const { useCase, repo } = montar({
      herramienta: new HerramientaConGuion([
        { ok: false, motivo: 'x', pregunta: '¿Cómo te llamas?' },
        demasiados,
      ]),
      guion: sinFin(),
    });
    const r = await useCase.execute({ ...wa, message: 'un corte' });
    expect(r.reply).toBe('¿Cómo te llamas?');
    expect(guardado(repo)).not.toContain('Se le preguntó');
  });

  it('la web no anota nada', async () => {
    const { useCase, repo } = montar({
      herramienta: new HerramientaConGuion([demasiados]),
      guion: [llamaYResponde()[0], respuesta('¿Cuál prefieres?')],
    });
    await useCase.execute({ userId: 'u-1', message: 'un corte' });
    expect(guardado(repo)).toBe('¿Cuál prefieres?');
  });

  it('el modelo ve la marca en el turno siguiente', async () => {
    const repo = new RepoDoble();
    const herramienta = new HerramientaConGuion([demasiados]);
    const { useCase, llm } = montar({
      repo,
      herramienta,
      guion: [
        llamaYResponde()[0],
        respuesta('¿Cuál prefieres?'),
        respuesta('Listo.'),
      ],
    });
    await useCase.execute({ ...wa, message: 'un corte' });
    repo.activaDelNumero = repo.guardada!;
    await useCase.execute({ ...wa, message: 'me da igual' });
    expect(JSON.stringify(llm.calls.at(-1)!.messages)).toContain(MARCA_ACOTAR);
  });
});

describe('SendMessageUseCase · ventana de recientes (I3)', () => {
  const conMensajes = (c: Conversation, n: number) => {
    for (let i = 0; i < n; i++) {
      c.append(
        i % 2 === 0 ? Message.user(`m${i}`) : Message.assistant(`m${i}`),
      );
    }
    return c;
  };

  it('en WhatsApp ve tanto como el modelo: 8 mensajes más el nuevo', async () => {
    const repo = new RepoDoble();
    repo.activaDelNumero = conMensajes(
      Conversation.fromPersistence({ id: 'c-wa', phoneE164: NUMERO }),
      10,
    );
    const { useCase, herramienta, llm } = montar({
      repo,
      guion: llamaYResponde(),
    });
    await useCase.execute({
      canal: 'whatsapp',
      phoneE164: NUMERO,
      userId: null,
      message: 'nuevo',
    });
    const textos = herramienta.contexto!.recientes!.map((m) => m.texto);
    expect(textos).toEqual([
      ...Array.from({ length: 8 }, (_, i) => `m${i + 2}`),
      'nuevo',
    ]);
    // Lo mismo que el modelo: el mensaje más viejo que ve sigue anclando.
    expect(JSON.stringify(llm.calls[0].messages)).toContain('m2');
    expect(JSON.stringify(llm.calls[0].messages)).not.toContain('"m1"');
  });

  it('la web sigue con los mismos: 4 más el nuevo', async () => {
    const repo = new RepoDoble();
    repo.porId = conMensajes(
      Conversation.fromPersistence({ id: 'c-web', userId: 'u-1' }),
      10,
    );
    const { useCase, herramienta } = montar({ repo, guion: llamaYResponde() });
    await useCase.execute({
      conversationId: 'c-web',
      userId: 'u-1',
      message: 'nuevo',
    });
    expect(herramienta.contexto!.recientes!.map((m) => m.texto)).toEqual([
      'm6',
      'm7',
      'm8',
      'm9',
      'nuevo',
    ]);
  });
});

describe('SendMessageUseCase · marcas copiadas por el modelo (N5)', () => {
  const wa = { canal: 'whatsapp' as const, phoneE164: NUMERO, userId: null };
  const guardado = (repo: RepoDoble) =>
    repo.guardada!.window(10).at(-1)!.content;

  it.each([
    '[Se le preguntó para acotar: corte]',
    '[Se le preguntó qué busca]',
    '[Se le enviaron aparte, con foto si la hay: 1. Corte: $ 35.000 (45 min)]',
    '[Se le envió aparte, con foto si la hay: 1. Mohawk con trenzas: $ 40.000 (45 min)]',
    '[Se le mostró aparte la lista de sus reservas.]',
    '[SE LE ENVIÓ ALGO]',
    '[Sé lé envió aparte: x]',
  ])('%s no llega a la clienta ni se guarda', async (marca) => {
    const { useCase, repo } = montar({
      guion: [respuesta(`Claro, dime.\n\n${marca}`)],
    });
    const r = await useCase.execute({ ...wa, message: 'hola' });
    expect(r.reply).toBe('Claro, dime.');
    expect(guardado(repo)).toBe('Claro, dime.');
  });

  it('también en medio del texto y sin tilde', async () => {
    const { useCase } = montar({
      guion: [
        respuesta(
          'Hola [Se le pregunto para acotar: corte] ¿qué tal?\n\n[Se le enviaron aparte: x]\n\nDime.',
        ),
      ],
    });
    const r = await useCase.execute({ ...wa, message: 'hola' });
    expect(r.reply).not.toMatch(/Se le|\[|\]/);
    expect(r.reply).toContain('¿qué tal?');
    expect(r.reply).toContain('Dime.');
  });

  it('solo las que empiezan por «[Se le »: otros corchetes y el resto quedan tal cual', async () => {
    const texto = '  Ver [nota] y [Mostrado aparte: x] y [Se lo dije]  ';
    const { useCase } = montar({ guion: [respuesta(texto)] });
    const r = await useCase.execute({ ...wa, message: 'hola' });
    expect(r.reply).toBe(texto);
  });

  it('si no queda nada, sigue el camino de la respuesta vacía', async () => {
    const { useCase, repo } = montar({
      guion: [respuesta('[Se le preguntó para acotar: corte]')],
    });
    const r = await useCase.execute({ ...wa, message: 'hola' });
    expect(r.reply).toMatch(/Disculpa/);
    expect(guardado(repo)).not.toContain('Se le preguntó');
  });

  it('la marca real del servidor se guarda una vez y no sale hacia la clienta', async () => {
    const demasiados = {
      ok: false,
      motivo: 'demasiados',
      pregunta: '¿Cuál?',
      concepto: ['corte'],
    };
    class Herramienta extends HerramientaEspia {
      async execute() {
        return demasiados;
      }
    }
    const marca = '[Se le preguntó para acotar: corte]';
    const { useCase, repo } = montar({
      herramienta: new Herramienta(),
      guion: [llamaYResponde()[0], respuesta(`¿Cuál?\n\n${marca}`)],
    });
    const r = await useCase.execute({ ...wa, message: 'un corte' });
    expect(r.reply).toBe('¿Cuál?');
    expect(guardado(repo)).toBe(`¿Cuál?\n\n${marca}`);
  });

  it('la web no cambia', async () => {
    const texto = 'Hola [Se le preguntó qué busca]';
    const { useCase } = montar({ guion: [respuesta(texto)] });
    const r = await useCase.execute({ userId: 'u-1', message: 'hola' });
    expect(r.reply).toBe(texto);
  });
});

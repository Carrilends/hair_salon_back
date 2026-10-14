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
}) {
  const repo = opts.repo ?? new RepoDoble();
  const llm = new FakeLlmAdapter(opts.guion ?? [respuesta('Hola.')]);
  const herramienta = new HerramientaEspia();
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

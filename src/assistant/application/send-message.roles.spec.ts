import { SendMessageUseCase } from './send-message.use-case';
import { DailyTokenLedger } from './daily-token-ledger';
import { FakeLlmAdapter } from '../infrastructure/llm/fake-llm.adapter';
import { Conversation } from '../domain/conversation';
import { TokenUsage } from '../domain/token-usage';
import {
  AssistantContext,
  AssistantTool,
  WhatsAppToolSets,
} from './tools/assistant-tool';
import { LlmCompletion } from '../domain/ports/llm.port';
import {
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_WHATSAPP_CLIENTA,
  SYSTEM_PROMPT_WHATSAPP_DUENA,
} from './system-prompt';

/**
 * Plan 06, F3b: el bucle elige juego de herramientas y prompt por canal y rol,
 * y SOLO ejecuta herramientas del juego que ofreció.
 */
class Herramienta implements AssistantTool {
  llamadas = 0;
  contexto?: AssistantContext;
  readonly definition;
  constructor(readonly name: string) {
    this.definition = {
      name,
      description: name,
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    };
  }
  async execute(_a: Record<string, unknown>, c: AssistantContext) {
    this.llamadas++;
    this.contexto = c;
    return { ok: true };
  }
}

const web = [
  new Herramienta('listarServicios'),
  new Herramienta('crearReserva'),
];
function juegos() {
  return {
    clienta: [
      new Herramienta('listarServicios'),
      new Herramienta('misReservas'),
    ],
    duena: [new Herramienta('verAgenda'), new Herramienta('confirmarReserva')],
  };
}

const pide = (nombre: string): LlmCompletion[] => [
  {
    message: {
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 't1', name: nombre, arguments: {} }],
    },
    usage: TokenUsage.of(1, 1),
  },
  {
    message: { role: 'assistant', content: 'listo' },
    usage: TokenUsage.of(1, 1),
  },
];

function montar(guion: LlmCompletion[], whatsapp?: WhatsAppToolSets) {
  const llm = new FakeLlmAdapter(guion);
  const repo = {
    findById: async () => null,
    save: async (c: Conversation) => c,
    countMessagesOfUserSince: async () => 0,
    sumTokensSince: async () => 0,
    usageSince: async () => ({}) as never,
    findActiveByPhone: async () => null,
    countMessagesOfPhoneSince: async () => 0,
  };
  const useCase = new SendMessageUseCase(
    llm,
    repo,
    web,
    { now: () => new Date('2026-10-14T15:00:00Z') },
    {
      maxMessagesPerConversation: 20,
      maxMessagesPerUserPerDay: 50,
      maxTokensPerDay: 0,
    },
    { execute: async () => ({ summary: 'r', usage: TokenUsage.zero() }) },
    new DailyTokenLedger(1),
    undefined,
    undefined,
    undefined,
    repo,
    whatsapp,
    // La dueña de estas pruebas (revisión de F3b: isAdmin exige su número).
    '573208977471',
  );
  return { useCase, llm };
}

const nombresOfrecidos = (llm: FakeLlmAdapter) =>
  (llm.calls[0].tools ?? []).map((t) => t.name);
const prompt = (llm: FakeLlmAdapter) => llm.calls[0].messages[0].content;

describe('SendMessageUseCase · juego de herramientas por rol (plan 06, F3b)', () => {
  it('la web: sus herramientas y su prompt de siempre', async () => {
    const { useCase, llm } = montar(pide('listarServicios'), juegos());

    await useCase.execute({ userId: 'u-1', message: 'hola' });

    expect(nombresOfrecidos(llm)).toEqual(['listarServicios', 'crearReserva']);
    expect(prompt(llm)).toBe(SYSTEM_PROMPT);
  });

  it('la clienta por WhatsApp: su juego y su prompt', async () => {
    const j = juegos();
    const { useCase, llm } = montar(pide('misReservas'), j);

    await useCase.execute({
      canal: 'whatsapp',
      phoneE164: '573001112233',
      userId: null,
      message: 'mis citas',
    });

    expect(nombresOfrecidos(llm)).toEqual(['listarServicios', 'misReservas']);
    expect(prompt(llm)).toBe(SYSTEM_PROMPT_WHATSAPP_CLIENTA);
    expect((j.clienta[1] as Herramienta).llamadas).toBe(1);
  });

  it('la dueña por WhatsApp: su juego y su prompt', async () => {
    const j = juegos();
    const { useCase, llm } = montar(pide('verAgenda'), j);

    await useCase.execute({
      canal: 'whatsapp',
      phoneE164: '573208977471',
      userId: null,
      isAdmin: true,
      message: 'agenda de hoy',
    });

    expect(nombresOfrecidos(llm)).toEqual(['verAgenda', 'confirmarReserva']);
    expect(prompt(llm)).toBe(SYSTEM_PROMPT_WHATSAPP_DUENA);
    expect((j.duena[0] as Herramienta).contexto).toMatchObject({
      canal: 'whatsapp',
      isAdmin: true,
    });
  });

  it('si el modelo pide una herramienta de OTRO rol, no se ejecuta', async () => {
    const j = juegos();
    const { useCase, llm } = montar(pide('verAgenda'), j);

    await useCase.execute({
      canal: 'whatsapp',
      phoneE164: '573001112233',
      userId: null,
      message: 'enséñame la agenda',
    });

    expect((j.duena[0] as Herramienta).llamadas).toBe(0);
    const resultado = llm.calls[1].messages.find((m) => m.role === 'tool');
    expect(JSON.parse(resultado!.content)).toEqual({
      ok: false,
      motivo: 'herramienta_desconocida',
    });
  });

  it('ni una de la web: la clienta de WhatsApp no alcanza crearReserva de la web', async () => {
    const { useCase } = montar(pide('crearReserva'), juegos());

    await useCase.execute({
      canal: 'whatsapp',
      phoneE164: '573001112233',
      userId: null,
      message: 'resérvame',
    });

    expect((web[1] as Herramienta).llamadas).toBe(0);
  });

  it('sin los juegos de WhatsApp cableados, falla claro y sin llamar al modelo', async () => {
    const { useCase, llm } = montar(pide('listarServicios'));

    await expect(
      useCase.execute({
        canal: 'whatsapp',
        phoneE164: '573001112233',
        userId: null,
        message: 'hola',
      }),
    ).rejects.toThrow(/herramientas de WhatsApp/);
    expect(llm.calls).toHaveLength(0);
  });
});

describe('prompts de WhatsApp', () => {
  it('no mandan a iniciar sesión ni hablan de tarjetas', () => {
    for (const p of [
      SYSTEM_PROMPT_WHATSAPP_CLIENTA,
      SYSTEM_PROMPT_WHATSAPP_DUENA,
    ]) {
      expect(p).not.toMatch(/iniciar sesi[oó]n|sesi[oó]n iniciada/i);
      expect(p).not.toMatch(/tarjeta/i);
    }
  });

  it('a la clienta le pide el nombre para reservar; a la dueña le dice que no crea', () => {
    expect(SYSTEM_PROMPT_WHATSAPP_CLIENTA).toMatch(/nombre/);
    expect(SYSTEM_PROMPT_WHATSAPP_DUENA).toMatch(/no creas reservas/i);
  });

  it('el de la web no cambió (la caché del proveedor depende de ello)', () => {
    expect(SYSTEM_PROMPT).toContain(
      'Para reservar o cancelar hace falta iniciar sesión; si no la hay, invita a hacerlo.',
    );
  });
});

/**
 * Revisión de seguridad de F3b, hallazgo 3: el caso de uso no se fía a ciegas
 * del `isAdmin` que le pase el webhook. Si el adaptador se equivocara, el
 * número tendría que ser además el de la dueña.
 */
describe('SendMessageUseCase · isAdmin en WhatsApp exige el número de la dueña', () => {
  function conDuena(numeroDuena?: string) {
    const llm = new FakeLlmAdapter([
      {
        message: { role: 'assistant', content: 'ok' },
        usage: TokenUsage.of(1, 1),
      },
    ]);
    const repo = {
      findById: async () => null,
      save: async (c: Conversation) => c,
      countMessagesOfUserSince: async () => 0,
      sumTokensSince: async () => 0,
      usageSince: async () => ({}) as never,
      findActiveByPhone: async () => null,
      countMessagesOfPhoneSince: async () => 0,
    };
    const useCase = new SendMessageUseCase(
      llm,
      repo,
      web,
      { now: () => new Date('2026-10-14T15:00:00Z') },
      {
        maxMessagesPerConversation: 20,
        maxMessagesPerUserPerDay: 50,
        maxTokensPerDay: 0,
      },
      { execute: async () => ({ summary: 'r', usage: TokenUsage.zero() }) },
      new DailyTokenLedger(1),
      undefined,
      undefined,
      undefined,
      repo,
      juegos(),
      numeroDuena,
    );
    return { useCase, llm };
  }

  it('un número cualquiera con isAdmin se rechaza sin llamar al modelo', async () => {
    const { useCase, llm } = conDuena('573208977471');

    await expect(
      useCase.execute({
        canal: 'whatsapp',
        phoneE164: '573001112233',
        userId: null,
        isAdmin: true,
        message: 'cancela todo',
      }),
    ).rejects.toThrow(/dueña/);
    expect(llm.calls).toHaveLength(0);
  });

  it('sin número de la dueña configurado, nadie es administración por WhatsApp', async () => {
    const { useCase } = conDuena(undefined);

    await expect(
      useCase.execute({
        canal: 'whatsapp',
        phoneE164: '573208977471',
        userId: null,
        isAdmin: true,
        message: 'agenda',
      }),
    ).rejects.toThrow(/dueña/);
  });

  it('el número de la dueña, escrito como sea en el entorno, sí', async () => {
    const { useCase } = conDuena('+57 320 897 7471');

    await expect(
      useCase.execute({
        canal: 'whatsapp',
        phoneE164: '573208977471',
        userId: null,
        isAdmin: true,
        message: 'agenda',
      }),
    ).resolves.toMatchObject({ reply: 'ok' });
  });
});

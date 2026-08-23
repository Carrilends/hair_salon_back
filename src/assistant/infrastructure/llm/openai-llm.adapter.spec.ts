import {
  OpenAiChatCreateParams,
  OpenAiClientLike,
  OpenAiLlmAdapter,
} from './openai-llm.adapter';
import { LlmToolDefinition } from '../../domain/ports/llm.port';

class FakeOpenAiClient implements OpenAiClientLike {
  lastParams: OpenAiChatCreateParams | undefined;
  chat: OpenAiClientLike['chat'];
  constructor(private readonly response: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.chat = {
      completions: {
        async create(params: OpenAiChatCreateParams): Promise<unknown> {
          self.lastParams = params;
          return self.response;
        },
      },
    };
  }
}

const CONFIG = {
  apiKey: 'sk-test',
  routerModel: 'modelo-barato',
  mainModel: 'modelo-capaz',
};

function response(overrides: Record<string, unknown> = {}) {
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'Tenemos Corte.',
          ...(overrides.message as object),
        },
      },
    ],
    usage: overrides.usage ?? {
      prompt_tokens: 100,
      completion_tokens: 20,
      prompt_tokens_details: { cached_tokens: 30 },
    },
  };
}

const TOOL_DEF: LlmToolDefinition = {
  name: 'listarServicios',
  description: 'busca servicios',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

describe('OpenAiLlmAdapter', () => {
  it('usa el modelo router por defecto y el main con tier=main', async () => {
    const clientR = new FakeOpenAiClient(response());
    await new OpenAiLlmAdapter(CONFIG, clientR).complete({
      messages: [{ role: 'user', content: 'hola' }],
    });
    expect(clientR.lastParams!.model).toBe('modelo-barato');

    const clientM = new FakeOpenAiClient(response());
    await new OpenAiLlmAdapter(CONFIG, clientM).complete({
      messages: [{ role: 'user', content: 'hola' }],
      tier: 'main',
    });
    expect(clientM.lastParams!.model).toBe('modelo-capaz');
  });

  it('traduce herramientas al formato function y fija temperatura baja', async () => {
    const client = new FakeOpenAiClient(response());
    await new OpenAiLlmAdapter(CONFIG, client).complete({
      messages: [{ role: 'user', content: 'hola' }],
      tools: [TOOL_DEF],
    });
    const tools = client.lastParams!.tools as Array<Record<string, unknown>>;
    expect(tools[0]).toEqual({
      type: 'function',
      function: {
        name: 'listarServicios',
        description: 'busca servicios',
        parameters: TOOL_DEF.parameters,
      },
    });
    expect(client.lastParams!.temperature).toBe(0.2);
  });

  it('traduce mensajes del dominio al formato del proveedor (incluidos tool y tool_calls)', async () => {
    const client = new FakeOpenAiClient(response());
    await new OpenAiLlmAdapter(CONFIG, client).complete({
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'quiero un corte' },
        {
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
        { role: 'tool', content: '[{"id":"s1"}]', toolCallId: 't1' },
      ],
    });
    const msgs = client.lastParams!.messages as Array<Record<string, unknown>>;
    expect(msgs[0]).toEqual({ role: 'system', content: 'sys' });
    expect(msgs[2]).toEqual({
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 't1',
          type: 'function',
          function: {
            name: 'listarServicios',
            arguments: '{"busqueda":"corte"}',
          },
        },
      ],
    });
    expect(msgs[3]).toEqual({
      role: 'tool',
      tool_call_id: 't1',
      content: '[{"id":"s1"}]',
    });
  });

  it('mapea la respuesta y el consumo, parseando los argumentos de herramienta', async () => {
    const client = new FakeOpenAiClient(
      response({
        message: {
          content: '',
          tool_calls: [
            {
              id: 'c1',
              type: 'function',
              function: {
                name: 'consultarDisponibilidad',
                arguments: '{"fecha":"2026-08-20"}',
              },
            },
          ],
        },
      }),
    );
    const result = await new OpenAiLlmAdapter(CONFIG, client).complete({
      messages: [{ role: 'user', content: 'mañana?' }],
    });
    expect(result.message.role).toBe('assistant');
    expect(result.message.toolCalls).toEqual([
      {
        id: 'c1',
        name: 'consultarDisponibilidad',
        arguments: { fecha: '2026-08-20' },
      },
    ]);
    expect(result.usage.promptTokens).toBe(100);
    expect(result.usage.completionTokens).toBe(20);
    expect(result.usage.cachedTokens).toBe(30);
  });

  it('sin clave y sin cliente inyectado, construir NO lanza pero complete sí (arranque perezoso)', async () => {
    const adapter = new OpenAiLlmAdapter({
      routerModel: 'm',
      mainModel: 'M',
    });
    await expect(
      adapter.complete({ messages: [{ role: 'user', content: 'hola' }] }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });
});

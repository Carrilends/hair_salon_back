import {
  GeminiClientLike,
  GeminiInteractionParams,
  GeminiLlmAdapter,
} from './gemini-llm.adapter';
import { LlmToolDefinition } from '../../domain/ports/llm.port';

/**
 * Doble del cliente de Google: captura los parámetros con los que el adaptador
 * llama al proveedor, para poder afirmar sobre la traducción sin red ni clave.
 */
class FakeGeminiClient implements GeminiClientLike {
  lastParams: GeminiInteractionParams | undefined;
  interactions: GeminiClientLike['interactions'];
  constructor(private readonly response: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.interactions = {
      async create(params: GeminiInteractionParams): Promise<unknown> {
        self.lastParams = params;
        return self.response;
      },
    };
  }
}

const CONFIG = {
  apiKey: 'clave-de-prueba',
  routerModel: 'modelo-barato',
  mainModel: 'modelo-capaz',
};

function respuesta(overrides: Record<string, unknown> = {}) {
  return {
    steps: overrides.steps ?? [
      {
        type: 'model_output',
        content: [{ type: 'text', text: 'Tenemos Corte.' }],
      },
    ],
    usage: overrides.usage ?? {
      total_input_tokens: 100,
      total_output_tokens: 20,
      total_cached_tokens: 30,
    },
  };
}

const TOOL_DEF: LlmToolDefinition = {
  name: 'listarServicios',
  description: 'busca servicios',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

describe('GeminiLlmAdapter', () => {
  it('usa el modelo router por defecto y el main con tier=main', async () => {
    const clienteR = new FakeGeminiClient(respuesta());
    await new GeminiLlmAdapter(CONFIG, clienteR).complete({
      messages: [{ role: 'user', content: 'hola' }],
    });
    expect(clienteR.lastParams!.model).toBe('modelo-barato');

    const clienteM = new FakeGeminiClient(respuesta());
    await new GeminiLlmAdapter(CONFIG, clienteM).complete({
      messages: [{ role: 'user', content: 'hola' }],
      tier: 'main',
    });
    expect(clienteM.lastParams!.model).toBe('modelo-capaz');
  });

  it('nunca deja que Google persista la conversación (store: false)', async () => {
    const cliente = new FakeGeminiClient(respuesta());
    await new GeminiLlmAdapter(CONFIG, cliente).complete({
      messages: [{ role: 'user', content: 'hola' }],
    });
    // La app ya guarda el historial en Postgres y el puerto es sin estado; además
    // persistir en Google agravaría lo que ya advierten sus términos de datos.
    expect(cliente.lastParams!.store).toBe(false);
  });

  it('manda el system prompt en system_instruction, no como un paso más', async () => {
    const cliente = new FakeGeminiClient(respuesta());
    await new GeminiLlmAdapter(CONFIG, cliente).complete({
      messages: [
        { role: 'system', content: 'eres la asistente de la peluquería' },
        { role: 'user', content: 'hola' },
      ],
    });
    expect(cliente.lastParams!.system_instruction).toBe(
      'eres la asistente de la peluquería',
    );
    // Y no debe colarse además dentro de los pasos de la conversación.
    expect(cliente.lastParams!.input).toHaveLength(1);
  });

  it('traduce los mensajes del dominio a pasos de la conversación', async () => {
    const cliente = new FakeGeminiClient(respuesta());
    await new GeminiLlmAdapter(CONFIG, cliente).complete({
      messages: [
        { role: 'user', content: 'quiero un corte' },
        { role: 'assistant', content: 'Tenemos varios.' },
      ],
    });
    expect(cliente.lastParams!.input).toEqual([
      {
        type: 'user_input',
        content: [{ type: 'text', text: 'quiero un corte' }],
      },
      {
        type: 'model_output',
        content: [{ type: 'text', text: 'Tenemos varios.' }],
      },
    ]);
  });

  it('recupera el nombre de la herramienta para function_result, que el dominio no lleva', async () => {
    const cliente = new FakeGeminiClient(respuesta());
    await new GeminiLlmAdapter(CONFIG, cliente).complete({
      messages: [
        { role: 'user', content: 'y mañana?' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 't1',
              name: 'listarServicios',
              arguments: { busqueda: 'corte' },
            },
            {
              id: 't2',
              name: 'consultarDisponibilidad',
              arguments: { fecha: '2026-09-07' },
            },
          ],
        },
        { role: 'tool', content: '[{"id":"s1"}]', toolCallId: 't1' },
        { role: 'tool', content: '["09:00"]', toolCallId: 't2' },
      ],
    });
    const pasos = cliente.lastParams!.input as Array<Record<string, unknown>>;

    // Las dos llamadas viajan como pasos planos e independientes (paralelas).
    expect(pasos[1]).toEqual({
      type: 'function_call',
      id: 't1',
      name: 'listarServicios',
      arguments: { busqueda: 'corte' },
    });

    // `LlmMessage` con role 'tool' solo trae `toolCallId` y `content`: el nombre
    // hay que rescatarlo de la llamada con ese mismo id. Con dos herramientas
    // en vuelo, emparejar mal es un fallo silencioso.
    expect(pasos[3]).toEqual({
      type: 'function_result',
      call_id: 't1',
      name: 'listarServicios',
      result: [{ type: 'text', text: '[{"id":"s1"}]' }],
    });
    expect(pasos[4]).toEqual({
      type: 'function_result',
      call_id: 't2',
      name: 'consultarDisponibilidad',
      result: [{ type: 'text', text: '["09:00"]' }],
    });
  });

  it('declara las herramientas en el formato plano de Gemini', async () => {
    const cliente = new FakeGeminiClient(respuesta());
    await new GeminiLlmAdapter(CONFIG, cliente).complete({
      messages: [{ role: 'user', content: 'hola' }],
      tools: [TOOL_DEF],
    });
    const tools = cliente.lastParams!.tools as Array<Record<string, unknown>>;
    // A diferencia de OpenAI, aquí no hay envoltorio `function: {...}`.
    expect(tools[0]).toEqual({
      type: 'function',
      name: 'listarServicios',
      description: 'busca servicios',
      parameters: TOOL_DEF.parameters,
    });
  });

  it('mapea la respuesta ignorando los pasos de razonamiento', async () => {
    const cliente = new FakeGeminiClient(
      respuesta({
        steps: [
          { type: 'thought', signature: 'abc', summary: 'pienso...' },
          {
            type: 'function_call',
            id: 'c1',
            name: 'consultarDisponibilidad',
            arguments: { fecha: '2026-09-07' },
          },
        ],
      }),
    );
    const resultado = await new GeminiLlmAdapter(CONFIG, cliente).complete({
      messages: [{ role: 'user', content: 'mañana?' }],
    });
    expect(resultado.message.role).toBe('assistant');
    expect(resultado.message.toolCalls).toEqual([
      {
        id: 'c1',
        name: 'consultarDisponibilidad',
        arguments: { fecha: '2026-09-07' },
      },
    ]);
  });

  it('extrae el texto del paso model_output y el consumo de tokens', async () => {
    const cliente = new FakeGeminiClient(respuesta());
    const resultado = await new GeminiLlmAdapter(CONFIG, cliente).complete({
      messages: [{ role: 'user', content: 'qué ofrecen?' }],
    });
    expect(resultado.message.content).toBe('Tenemos Corte.');
    expect(resultado.message.toolCalls).toBeUndefined();
    expect(resultado.usage.promptTokens).toBe(100);
    expect(resultado.usage.completionTokens).toBe(20);
    expect(resultado.usage.cachedTokens).toBe(30);
  });

  it('sin clave y sin cliente inyectado, construir NO lanza pero complete sí (arranque perezoso)', async () => {
    const adapter = new GeminiLlmAdapter({
      routerModel: 'm',
      mainModel: 'M',
    });
    await expect(
      adapter.complete({ messages: [{ role: 'user', content: 'hola' }] }),
    ).rejects.toThrow(/GEMINI_API_KEY/);
  });
});

import OpenAI from 'openai';
import {
  LlmCompletion,
  LlmMessage,
  LlmPort,
  LlmToolCall,
} from '../../domain/ports/llm.port';
import { TokenUsage } from '../../domain/token-usage';

export interface OpenAiChatCreateParams {
  model: string;
  messages: unknown[];
  tools?: unknown[];
  temperature?: number;
}

/**
 * Superficie mínima del cliente de OpenAI que este adaptador usa. Permite
 * inyectar un doble en las pruebas sin depender del SDK real ni de la red.
 */
export interface OpenAiClientLike {
  chat: {
    completions: {
      create(params: OpenAiChatCreateParams): Promise<unknown>;
    };
  };
}

export interface OpenAiLlmConfig {
  apiKey?: string;
  routerModel: string;
  mainModel: string;
}

/**
 * Único archivo que conoce a OpenAI (regla de dependencias de A1). Traduce el
 * `LlmPort` del dominio a la API del proveedor y de vuelta, incluidos los
 * argumentos de herramienta —que viajan como texto JSON—.
 *
 * **Arranque perezoso:** el cliente real solo se construye en la primera llamada
 * a `complete()`. Así la app arranca sin `OPENAI_API_KEY` (queda "lista para
 * enchufar la clave") y solo una petición real al asistente falla, con un mensaje
 * claro, si la clave no está configurada.
 */
export class OpenAiLlmAdapter implements LlmPort {
  private client?: OpenAiClientLike;

  constructor(
    private readonly config: OpenAiLlmConfig,
    client?: OpenAiClientLike,
  ) {
    this.client = client;
  }

  async complete(input: {
    messages: LlmMessage[];
    tools?: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }[];
    tier?: 'router' | 'main';
  }): Promise<LlmCompletion> {
    const model =
      input.tier === 'main' ? this.config.mainModel : this.config.routerModel;

    const response = (await this.getClient().chat.completions.create({
      model,
      messages: input.messages.map(toProviderMessage),
      tools: input.tools?.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      // Temperatura baja: aquí no se busca creatividad sino acertar con la
      // herramienta y sus argumentos. Además reduce reintentos, que cuestan.
      temperature: 0.2,
    })) as ProviderResponse;

    const choice = response.choices?.[0];
    return {
      message: fromProviderMessage(choice?.message),
      usage: TokenUsage.of(
        response.usage?.prompt_tokens ?? 0,
        response.usage?.completion_tokens ?? 0,
        response.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      ),
    };
  }

  private getClient(): OpenAiClientLike {
    if (this.client) return this.client;
    if (!this.config.apiKey) {
      throw new Error(
        'OPENAI_API_KEY no está configurada: el asistente no puede llamar al proveedor.',
      );
    }
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
    }) as unknown as OpenAiClientLike;
    return this.client;
  }
}

interface ProviderToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

interface ProviderMessage {
  role: string;
  content: string | null;
  tool_calls?: ProviderToolCall[];
}

interface ProviderResponse {
  choices?: { message?: ProviderMessage }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

function toProviderMessage(m: LlmMessage): Record<string, unknown> {
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
  }
  if (m.role === 'assistant' && m.toolCalls?.length) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

function fromProviderMessage(message?: ProviderMessage): LlmMessage {
  const toolCalls: LlmToolCall[] | undefined = message?.tool_calls?.map(
    (tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParseArgs(tc.function.arguments),
    }),
  );
  return {
    role: 'assistant',
    content: message?.content ?? '',
    ...(toolCalls && toolCalls.length ? { toolCalls } : {}),
  };
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

import { GoogleGenAI } from '@google/genai';
import {
  LlmCompletion,
  LlmMessage,
  LlmPort,
  LlmToolCall,
} from '../../domain/ports/llm.port';
import { TokenUsage } from '../../domain/token-usage';
import { LlmUnavailableError } from '../../domain/errors';

export interface GeminiInteractionParams {
  model: string;
  input: unknown[];
  tools?: unknown[];
  system_instruction?: string;
  store?: boolean;
}

/**
 * Superficie mínima del cliente de Google que este adaptador usa. Permite
 * inyectar un doble en las pruebas sin depender del SDK real ni de la red.
 */
export interface GeminiClientLike {
  interactions: {
    create(params: GeminiInteractionParams): Promise<unknown>;
  };
}

export interface GeminiLlmConfig {
  apiKey?: string;
  routerModel: string;
  mainModel: string;
}

export class GeminiLlmAdapter implements LlmPort {
  constructor(
    private readonly config: GeminiLlmConfig,
    private client?: GeminiClientLike,
  ) {}

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

    // Gemini no acepta el system prompt como un turno más: va en un parámetro
    // aparte. El puerto sí lo manda como mensaje, así que hay que separarlo.
    const system = input.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n');
    const conversacion = input.messages.filter((m) => m.role !== 'system');

    let respuesta: RespuestaProveedor;
    try {
      respuesta = (await this.getClient().interactions.create({
        model,
        input: aPasos(conversacion),
        ...(system ? { system_instruction: system } : {}),
        tools: input.tools?.map((t) => ({
          type: 'function',
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
        // La app ya guarda el historial en Postgres y el puerto es sin estado.
        store: false,
      })) as RespuestaProveedor;
    } catch (error) {
      // Credencial ausente, cuota agotada o petición rechazada: todo sale por
      // aquí con un mensaje seguro; el detalle queda en `causa` para el log.
      throw new LlmUnavailableError(error as Error);
    }

    return {
      message: deRespuesta(respuesta),
      usage: TokenUsage.of(
        respuesta.usage?.total_input_tokens ?? 0,
        respuesta.usage?.total_output_tokens ?? 0,
        respuesta.usage?.total_cached_tokens ?? 0,
      ),
    };
  }

  private getClient(): GeminiClientLike {
    if (this.client) return this.client;
    if (!this.config.apiKey) {
      throw new Error(
        'GEMINI_API_KEY no está configurada: el asistente no puede llamar al proveedor.',
      );
    }
    this.client = new GoogleGenAI({
      apiKey: this.config.apiKey,
    }) as unknown as GeminiClientLike;
    return this.client;
  }
}

interface PasoProveedor {
  type: string;
  id?: string;
  name?: string;
  signature?: string;
  arguments?: Record<string, unknown>;
  content?: { type: string; text?: string }[];
}

interface RespuestaProveedor {
  steps?: PasoProveedor[];
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_cached_tokens?: number;
  };
}

/**
 * Lee la respuesta por el **tipo** de cada paso, nunca por su posición: el
 * último puede ser un `function_call` o un `thought`, no necesariamente texto.
 *
 * El **texto** del razonamiento se descarta —no es parte de la conversación—
 * pero su **firma** se conserva: sin devolverla, el proveedor rechaza la
 * continuación del bucle de herramientas (verificado el 2026-09-08).
 */
function deRespuesta(respuesta: RespuestaProveedor): LlmMessage {
  const pasos = respuesta.steps ?? [];

  const texto = pasos
    .filter((p) => p.type === 'model_output')
    .flatMap((p) => p.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');

  const toolCalls: LlmToolCall[] = pasos
    .filter((p) => p.type === 'function_call')
    .map((p) => ({
      id: p.id ?? '',
      name: p.name ?? '',
      arguments: p.arguments ?? {},
    }));

  const firma = pasos.find((p) => p.type === 'thought')?.signature;

  return {
    role: 'assistant',
    content: texto,
    ...(firma ? { providerState: firma } : {}),
    ...(toolCalls.length ? { toolCalls } : {}),
  };
}

function textoDe(contenido: string) {
  return [{ type: 'text', text: contenido }];
}

/**
 * Traduce los mensajes del dominio a los pasos de la conversación de Gemini.
 *
 * Un `LlmMessage` con `role: 'tool'` solo trae `toolCallId` y `content`, pero
 * `function_result` exige además el **nombre** de la herramienta. Por eso se
 * indexa primero id→nombre a partir de las llamadas que el modelo pidió: sin
 * ese índice el emparejamiento sería por posición y fallaría en silencio en
 * cuanto hubiera dos herramientas en vuelo.
 */
function aPasos(mensajes: LlmMessage[]): unknown[] {
  const nombrePorId = new Map<string, string>();
  for (const m of mensajes) {
    for (const tc of m.toolCalls ?? []) nombrePorId.set(tc.id, tc.name);
  }

  return mensajes.flatMap((m): unknown[] => {
    if (m.role === 'tool') {
      return [
        {
          type: 'function_result',
          call_id: m.toolCallId,
          name: nombrePorId.get(m.toolCallId ?? '') ?? '',
          result: textoDe(m.content),
        },
      ];
    }

    if (m.role === 'assistant') {
      const pasos: unknown[] = [];
      if (m.content) {
        pasos.push({ type: 'model_output', content: textoDe(m.content) });
      }
      // La firma del razonamiento va ANTES de las llamadas que produjo. Omitirla
      // hace que el proveedor rechace el turno entero con un `400` opaco.
      if (m.toolCalls?.length && m.providerState) {
        pasos.push({ type: 'thought', signature: m.providerState });
      }
      for (const tc of m.toolCalls ?? []) {
        pasos.push({
          type: 'function_call',
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        });
      }
      return pasos;
    }

    return [{ type: 'user_input', content: textoDe(m.content) }];
  });
}

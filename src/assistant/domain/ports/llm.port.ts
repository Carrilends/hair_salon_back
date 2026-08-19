import { TokenUsage } from '../token-usage';

/** Llamada a herramienta que el modelo solicita (ya normalizada al dominio). */
export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Mensaje en el lenguaje del dominio, independiente de la forma del proveedor. */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: LlmToolCall[];
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  /** Esquema JSON de los argumentos. Compacto a propósito (§6.2). */
  parameters: Record<string, unknown>;
}

export interface LlmCompletion {
  message: LlmMessage;
  usage: TokenUsage;
}

/**
 * El proveedor de IA, detrás de una interfaz del dominio. Es la pieza que hace
 * toda la fase barata de probar (A1): con un adaptador falso se ejercita el
 * bucle completo sin gastar un token ni depender de la red. Solo su adaptador de
 * infraestructura (T5) conoce al proveedor real.
 */
export interface LlmPort {
  complete(input: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    /** Permite el enrutamiento por coste: barato por defecto (§6.2). */
    tier?: 'router' | 'main';
  }): Promise<LlmCompletion>;
}

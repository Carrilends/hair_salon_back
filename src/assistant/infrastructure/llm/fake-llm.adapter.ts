import {
  LlmCompletion,
  LlmMessage,
  LlmPort,
  LlmToolDefinition,
} from '../../domain/ports/llm.port';

export interface FakeLlmCall {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  tier?: 'router' | 'main';
}

/**
 * LLM de pruebas: reproduce guiones deterministas (A1). Ante cada llamada
 * devuelve el siguiente `LlmCompletion` del guion; si el guion se agota, **lanza**,
 * convirtiendo "el bucle dio más vueltas de las previstas" en una prueba que
 * falla en lugar de en una factura. Registra cada llamada para poder inspeccionar
 * qué mensajes y en qué `tier` se enviaron.
 */
export class FakeLlmAdapter implements LlmPort {
  private turn = 0;
  readonly calls: FakeLlmCall[] = [];

  constructor(private readonly script: LlmCompletion[]) {}

  async complete(input: {
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    tier?: 'router' | 'main';
  }): Promise<LlmCompletion> {
    this.calls.push({
      messages: input.messages,
      tools: input.tools,
      tier: input.tier,
    });
    const next = this.script[this.turn++];
    if (!next) {
      throw new Error(
        'El guion del LLM falso se agotó: el bucle dio más vueltas de las previstas',
      );
    }
    return next;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { LlmPort } from '../domain/ports/llm.port';
import { TokenUsage } from '../domain/token-usage';
import { Conversation } from '../domain/conversation';
import { LLM } from './tokens';

/** Contrato del resumidor, para poder inyectar un doble en las pruebas. */
export interface ConversationSummarizer {
  execute(
    conversation: Conversation,
  ): Promise<{ summary: string; usage: TokenUsage }>;
}

const SUMMARY_INSTRUCTION =
  'Resume en 2 o 3 frases, en español, lo esencial de esta conversación para poder continuarla después. Conserva los servicios, fechas y horas mencionados. No inventes nada.';

/**
 * Regenera el resumen de una conversación con el **modelo barato** (`tier:
 * 'router'`, §6.2). Comprime los turnos antiguos para que la ventana siga
 * costando poco a medida que la conversación crece.
 */
@Injectable()
export class SummarizeConversationUseCase implements ConversationSummarizer {
  constructor(@Inject(LLM) private readonly llm: LlmPort) {}

  async execute(
    conversation: Conversation,
  ): Promise<{ summary: string; usage: TokenUsage }> {
    const history = conversation.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    const completion = await this.llm.complete({
      messages: [
        { role: 'system', content: SUMMARY_INSTRUCTION },
        { role: 'user', content: history },
      ],
      tier: 'router',
    });
    return { summary: completion.message.content, usage: completion.usage };
  }
}

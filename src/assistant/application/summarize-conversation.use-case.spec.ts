import { SummarizeConversationUseCase } from './summarize-conversation.use-case';
import { FakeLlmAdapter } from '../infrastructure/llm/fake-llm.adapter';
import { Conversation } from '../domain/conversation';
import { Message } from '../domain/message';
import { TokenUsage } from '../domain/token-usage';

describe('SummarizeConversationUseCase', () => {
  it('resume con el modelo barato (tier router) y devuelve texto y consumo', async () => {
    const llm = new FakeLlmAdapter([
      {
        message: {
          role: 'assistant',
          content: 'La clienta preguntó por cortes.',
        },
        usage: TokenUsage.of(50, 10),
      },
    ]);
    const conversation = Conversation.start({ userId: 'u1' });
    conversation.append(Message.user('quiero un corte'));
    const summarizer = new SummarizeConversationUseCase(llm);

    const result = await summarizer.execute(conversation);

    expect(result.summary).toBe('La clienta preguntó por cortes.');
    expect(result.usage.total).toBe(60);
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0].tier).toBe('router');
  });
});

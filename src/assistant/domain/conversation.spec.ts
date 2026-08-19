import { Conversation } from './conversation';
import { Message } from './message';
import { TokenUsage } from './token-usage';
import { BudgetExceededError } from './errors';

function conversationWith(n: number): Conversation {
  const c = Conversation.start({ userId: 'u-1' });
  for (let i = 0; i < n; i++) {
    c.append(Message.user(`mensaje ${i}`));
  }
  return c;
}

describe('Conversation', () => {
  it('la ventana devuelve solo los últimos mensajes', () => {
    const c = conversationWith(20);
    const window = c.window(8);
    expect(window).toHaveLength(8);
    expect(window[7].content).toBe('mensaje 19');
  });

  it('con pocos mensajes la ventana los devuelve todos', () => {
    expect(conversationWith(3).window(8)).toHaveLength(3);
  });

  it('pide resumen cada 10 mensajes y no antes', () => {
    expect(conversationWith(9).needsSummary(10)).toBe(false);
    expect(conversationWith(10).needsSummary(10)).toBe(true);
  });

  it('rechaza continuar cuando se agota el presupuesto de mensajes', () => {
    const c = conversationWith(20);
    expect(() => c.assertWithinBudget(20)).toThrow(BudgetExceededError);
    expect(() => c.assertWithinBudget(50)).not.toThrow();
  });

  it('acumula el consumo de tokens de cada turno', () => {
    const c = Conversation.start({ userId: 'u-1' });
    c.recordUsage(TokenUsage.of(100, 50));
    c.recordUsage(TokenUsage.of(200, 30));
    expect(c.usage.promptTokens).toBe(300);
    expect(c.usage.total).toBe(380);
  });
});

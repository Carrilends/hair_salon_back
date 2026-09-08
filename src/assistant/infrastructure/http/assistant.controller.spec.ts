import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AssistantController, LEGAL_NOTICE } from './assistant.controller';
import { User } from 'src/auth/entities/user.entity';
import {
  BudgetExceededError,
  ConversationAccessError,
  LlmUnavailableError,
} from '../../domain/errors';
import { SendMessageInput } from '../../application/send-message.use-case';

class FakeSendMessage {
  lastInput?: SendMessageInput;
  constructor(private readonly behavior: (i: SendMessageInput) => unknown) {}
  async execute(input: SendMessageInput): Promise<unknown> {
    this.lastInput = input;
    return this.behavior(input);
  }
}

function req(user: User | null): { user?: User | null } {
  return { user };
}

describe('AssistantController', () => {
  it('pasa el userId del JWT y devuelve la respuesta (sin aviso al reanudar)', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c1',
      reply: 'Hola',
    }));
    const ctrl = new AssistantController(uc as never);

    const res = await ctrl.messages(
      { conversationId: 'c1', message: 'hola' },
      req({ id: 'u1' } as User),
    );

    expect(uc.lastInput).toEqual({
      conversationId: 'c1',
      message: 'hola',
      userId: 'u1',
    });
    expect(res).toEqual({ conversationId: 'c1', reply: 'Hola' });
  });

  it('sin sesión pasa userId null', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c9',
      reply: 'ok',
    }));
    const ctrl = new AssistantController(uc as never);

    await ctrl.messages({ message: 'hola' }, req(null));

    expect(uc.lastInput!.userId).toBeNull();
  });

  it('en una conversación nueva incluye el aviso legal', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c-new',
      reply: 'ok',
    }));
    const ctrl = new AssistantController(uc as never);

    const res = (await ctrl.messages({ message: 'hola' }, req(null))) as {
      aviso?: string;
    };
    expect(res.aviso).toBe(LEGAL_NOTICE);
  });

  it('con presupuesto agotado responde con el mensaje, sin lanzar', async () => {
    const uc = new FakeSendMessage(() => {
      throw new BudgetExceededError();
    });
    const ctrl = new AssistantController(uc as never);

    const res = (await ctrl.messages(
      { conversationId: 'c1', message: 'hola' },
      req({ id: 'u1' } as User),
    )) as { reply: string };
    expect(res.reply).toContain('límite de mensajes');
  });

  it('al reanudar una conversación ajena responde 404', async () => {
    const uc = new FakeSendMessage(() => {
      throw new ConversationAccessError();
    });
    const ctrl = new AssistantController(uc as never);

    await expect(
      ctrl.messages(
        { conversationId: 'ajena', message: 'hola' },
        req({ id: 'u1' } as User),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un fallo del proveedor se traduce en 503 sin filtrar el detalle', async () => {
    const causa = new Error('400 Request contains an invalid argument.');
    const uc = new FakeSendMessage(() => {
      throw new LlmUnavailableError(causa);
    });
    const ctrl = new AssistantController(uc as never);

    const error = await ctrl
      .messages({ message: 'hola' }, req(null))
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    // El detalle del proveedor no viaja al cliente: queda para el log.
    expect(JSON.stringify(error)).not.toMatch(/invalid argument/);
  });
});

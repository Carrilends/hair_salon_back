import { NotFoundException } from '@nestjs/common';
import { AssistantController, LEGAL_NOTICE } from './assistant.controller';
import { User } from 'src/auth/entities/user.entity';
import {
  BudgetExceededError,
  ConversationAccessError,
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
      isAdmin: false,
    });
    expect(res).toEqual({ conversationId: 'c1', reply: 'Hola' });
  });

  it('deriva isAdmin=true cuando el JWT trae el rol admin', async () => {
    // El rol admin sale del JWT, nunca de la conversación (regla de seguridad F6).
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c1',
      reply: 'ok',
    }));
    const ctrl = new AssistantController(uc as never);

    await ctrl.messages(
      { conversationId: 'c1', message: 'cancela la reserva' },
      req({ id: 'admin-1', roles: ['admin'] } as User),
    );

    expect(uc.lastInput!.isAdmin).toBe(true);
    expect(uc.lastInput!.userId).toBe('admin-1');
  });

  it('deriva isAdmin=false para un usuario sin rol admin', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c1',
      reply: 'ok',
    }));
    const ctrl = new AssistantController(uc as never);

    await ctrl.messages(
      { conversationId: 'c1', message: 'hola' },
      req({ id: 'u1', roles: ['user'] } as User),
    );

    expect(uc.lastInput!.isAdmin).toBe(false);
  });

  it('incluye la propuesta estructurada cuando el caso de uso la devuelve', async () => {
    const propuesta = {
      evento: 'boda',
      serviciosIds: ['r1', 'm1'],
      total: 150000,
    };
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c1',
      reply: 'Aquí tu paquete.',
      propuesta,
    }));
    const ctrl = new AssistantController(uc as never);

    const res = (await ctrl.messages(
      { conversationId: 'c1', message: 'me caso' },
      req({ id: 'u1' } as User),
    )) as { propuesta?: unknown };

    expect(res.propuesta).toEqual(propuesta);
  });

  it('no incluye propuesta cuando no la hay', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c1',
      reply: 'Hola',
    }));
    const ctrl = new AssistantController(uc as never);

    const res = (await ctrl.messages(
      { conversationId: 'c1', message: 'hola' },
      req({ id: 'u1' } as User),
    )) as Record<string, unknown>;

    expect('propuesta' in res).toBe(false);
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
});

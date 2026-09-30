import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AssistantController, LEGAL_NOTICE } from './assistant.controller';
import { User } from 'src/auth/entities/user.entity';
import {
  BudgetExceededError,
  ConversationAccessError,
  LlmUnavailableError,
} from '../../domain/errors';
import { SendMessageInput } from '../../application/send-message.use-case';
import { SlidingWindowRateLimiter } from 'src/common/rate-limit/sliding-window-rate-limiter';

class FakeSendMessage {
  lastInput?: SendMessageInput;
  constructor(private readonly behavior: (i: SendMessageInput) => unknown) {}
  async execute(input: SendMessageInput): Promise<unknown> {
    this.lastInput = input;
    return this.behavior(input);
  }
}

function req(
  user: User | null,
  ip = '190.24.1.5',
): { user?: User | null; ip?: string } {
  return { user, ip };
}

/**
 * El tope por IP de las pruebas que no lo miran es holgado a propósito: solo
 * las suyas lo aprietan.
 */
function controlador(
  uc: FakeSendMessage,
  limitador = new SlidingWindowRateLimiter(1000, 3_600_000),
  usage: { execute: () => Promise<unknown> } = {
    execute: async () => INFORME_DE_GASTO,
  },
): AssistantController {
  return new AssistantController(uc as never, usage as never, limitador);
}

const INFORME_DE_GASTO = {
  desde: '2026-09-29T05:00:00.000Z',
  hoy: {
    promptTokens: 1200,
    completionTokens: 340,
    cachedTokens: 900,
    totalTokens: 1540,
    mensajes: 14,
    conversaciones: 3,
  },
  techoDiarioTokens: 200_000,
  restanteTokens: 198_460,
};

describe('AssistantController', () => {
  it('pasa el userId del JWT y devuelve la respuesta (sin aviso al reanudar)', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c1',
      reply: 'Hola',
    }));
    const ctrl = controlador(uc);

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
    const ctrl = controlador(uc);

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
    const ctrl = controlador(uc);

    await ctrl.messages(
      { conversationId: 'c1', message: 'hola' },
      req({ id: 'u1', roles: ['user'] } as User),
    );

    expect(uc.lastInput!.isAdmin).toBe(false);
  });

  it('incluye las presentaciones cuando el caso de uso las devuelve', async () => {
    const presentaciones = [
      { tipo: 'paquete', evento: 'boda', total: 150000 },
      { tipo: 'servicios', servicios: [{ id: 's1', nombre: 'Corte' }] },
    ];
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c1',
      reply: 'Aquí tu paquete.',
      presentaciones,
    }));
    const ctrl = controlador(uc);

    const res = (await ctrl.messages(
      { conversationId: 'c1', message: 'me caso' },
      req({ id: 'u1' } as User),
    )) as { presentaciones?: unknown };

    expect(res.presentaciones).toEqual(presentaciones);
  });

  it('no incluye presentaciones cuando no las hay', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c1',
      reply: 'Hola',
    }));
    const ctrl = controlador(uc);

    const res = (await ctrl.messages(
      { conversationId: 'c1', message: 'hola' },
      req({ id: 'u1' } as User),
    )) as Record<string, unknown>;

    expect('presentaciones' in res).toBe(false);
  });

  it('sin sesión pasa userId null', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c9',
      reply: 'ok',
    }));
    const ctrl = controlador(uc);

    await ctrl.messages({ message: 'hola' }, req(null));

    expect(uc.lastInput!.userId).toBeNull();
  });

  it('en una conversación nueva incluye el aviso legal', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c-new',
      reply: 'ok',
    }));
    const ctrl = controlador(uc);

    const res = (await ctrl.messages({ message: 'hola' }, req(null))) as {
      aviso?: string;
    };
    expect(res.aviso).toBe(LEGAL_NOTICE);
  });

  it('con presupuesto agotado responde con el mensaje, sin lanzar', async () => {
    const uc = new FakeSendMessage(() => {
      throw new BudgetExceededError();
    });
    const ctrl = controlador(uc);

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
    const ctrl = controlador(uc);

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
    const ctrl = controlador(uc);

    const error = await ctrl
      .messages({ message: 'hola' }, req(null))
      .then(() => null)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    // El detalle del proveedor no viaja al cliente: queda para el log.
    expect(JSON.stringify(error)).not.toMatch(/invalid argument/);
  });
  describe('tope por IP (anónimos)', () => {
    function contador(): FakeSendMessage & { veces: number } {
      const uc = new FakeSendMessage(() => ({
        conversationId: 'c1',
        reply: 'ok',
      }));
      const espia = uc as FakeSendMessage & { veces: number };
      espia.veces = 0;
      const original = uc.execute.bind(uc);
      uc.execute = async (i: SendMessageInput) => {
        espia.veces++;
        return original(i);
      };
      return espia;
    }

    it('pasado el tope, la petición se rechaza SIN llamar al caso de uso', async () => {
      const uc = contador();
      const ctrl = controlador(uc, new SlidingWindowRateLimiter(2, 3_600_000));

      await ctrl.messages({ message: 'una' }, req(null));
      await ctrl.messages({ message: 'dos' }, req(null));
      const tercera = (await ctrl.messages({ message: 'tres' }, req(null))) as {
        reply: string;
        conversationId: string | null;
      };

      // Lo que se compra con el tope es justamente no pagar la llamada.
      expect(uc.veces).toBe(2);
      expect(tercera.reply).toContain('límite de mensajes');
      expect(tercera.conversationId).toBeNull();
    });

    it('se responde 200 con cortesía, no un 429 crudo al widget', async () => {
      const uc = contador();
      const ctrl = controlador(uc, new SlidingWindowRateLimiter(0, 3_600_000));

      const res = await ctrl.messages({ message: 'hola' }, req(null));

      expect(res).toEqual({ conversationId: null, reply: expect.any(String) });
    });

    it('quien tiene sesión no pasa por el tope por IP: ya lo acota el tope diario', async () => {
      const uc = contador();
      const ctrl = controlador(uc, new SlidingWindowRateLimiter(0, 3_600_000));

      await ctrl.messages({ message: 'hola' }, req({ id: 'u1' } as User));

      expect(uc.veces).toBe(1);
    });

    it('dos orígenes distintos no comparten cubo', async () => {
      const uc = contador();
      const ctrl = controlador(uc, new SlidingWindowRateLimiter(1, 3_600_000));

      await ctrl.messages({ message: 'hola' }, req(null, '190.24.1.5'));
      await ctrl.messages({ message: 'hola' }, req(null, '186.30.2.9'));

      expect(uc.veces).toBe(2);
    });

    it('sin IP conocida las peticiones comparten cubo: falla cerrado', async () => {
      const uc = contador();
      const ctrl = controlador(uc, new SlidingWindowRateLimiter(1, 3_600_000));

      await ctrl.messages({ message: 'hola' }, { user: null });
      await ctrl.messages({ message: 'hola' }, { user: null });

      expect(uc.veces).toBe(1);
    });

    it('omitir conversationId no permite saltarse el tope por conversación (T2)', async () => {
      // La evasión consistía en abrir conversación nueva en cada POST: el tope
      // de 20 por conversación nunca se alcanzaba. Ahora el origen sí se acota.
      const uc = contador();
      const ctrl = controlador(uc, new SlidingWindowRateLimiter(3, 3_600_000));

      for (let i = 0; i < 10; i++) {
        await ctrl.messages({ message: `mensaje ${i}` }, req(null));
      }

      expect(uc.veces).toBe(3);
    });
  });
  it('devuelve el informe de gasto del día tal cual lo da el caso de uso', async () => {
    const uc = new FakeSendMessage(() => ({
      conversationId: 'c1',
      reply: 'ok',
    }));
    const ctrl = controlador(uc, undefined, {
      execute: async () => INFORME_DE_GASTO,
    });

    await expect(ctrl.usage()).resolves.toEqual(INFORME_DE_GASTO);
  });
});

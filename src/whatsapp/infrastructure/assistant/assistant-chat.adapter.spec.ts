import { SendMessageUseCase } from 'src/assistant/application/send-message.use-case';
import {
  BudgetExceededError,
  DAILY_CEILING_REPLY,
  LlmUnavailableError,
} from 'src/assistant/domain/errors';
import { ServiceCatalogQueryAdapter } from 'src/assistant/infrastructure/catalog/service-catalog-query.adapter';
import { AssistantChatAdapter } from './assistant-chat.adapter';

const NUMERO = '573001112233';

function montar(
  execute: jest.Mock,
  findNamesByIds: jest.Mock = jest.fn().mockResolvedValue(new Map()),
) {
  return new AssistantChatAdapter(
    { execute } as unknown as SendMessageUseCase,
    { findNamesByIds } as unknown as ServiceCatalogQueryAdapter,
  );
}

describe('AssistantChatAdapter (plan 06, F5)', () => {
  it('llama al asistente con la identidad del canal y sin userId', async () => {
    const execute = jest
      .fn()
      .mockResolvedValue({ reply: 'Hola', conversacionNueva: true });
    await montar(execute).conversar({
      phoneE164: NUMERO,
      esDuena: false,
      texto: 'hola',
    });
    expect(execute).toHaveBeenCalledWith({
      canal: 'whatsapp',
      phoneE164: NUMERO,
      userId: null,
      isAdmin: false,
      message: 'hola',
    });
  });

  it('la dueña va como administración', async () => {
    const execute = jest.fn().mockResolvedValue({ reply: 'x' });
    await montar(execute).conversar({
      phoneE164: NUMERO,
      esDuena: true,
      texto: 'agenda',
    });
    expect(execute.mock.calls[0][0].isAdmin).toBe(true);
  });

  it('devuelve el texto, las presentaciones (o lista vacía) y si es nueva', async () => {
    const r = await montar(
      jest.fn().mockResolvedValue({ reply: 'Hola' }),
    ).conversar({
      phoneE164: NUMERO,
      esDuena: false,
      texto: 'hola',
    });
    expect(r).toEqual({
      ok: true,
      reply: 'Hola',
      presentaciones: [],
      conversacionNueva: false,
    });
  });

  it.each([
    [new BudgetExceededError(), 'limite'],
    [new BudgetExceededError(DAILY_CEILING_REPLY), 'no_disponible'],
    [new LlmUnavailableError(new Error('401')), 'no_disponible'],
    [new Error('inesperado'), 'error'],
  ])('traduce %p a «%s» sin lanzar', async (error, motivo) => {
    const r = await montar(jest.fn().mockRejectedValue(error)).conversar({
      phoneE164: NUMERO,
      esDuena: false,
      texto: 'hola',
    });
    expect(r).toEqual({ ok: false, motivo });
  });

  describe('nombreDelServicio', () => {
    const ID = '1b2c3d4e-5f60-4a71-8b82-93a4b5c6d7e8';

    it('devuelve el nombre que lee el catálogo', async () => {
      const find = jest.fn().mockResolvedValue(new Map([[ID, 'Balayage']]));
      const nombre = await montar(jest.fn(), find).nombreDelServicio(ID);
      expect(nombre).toBe('Balayage');
      expect(find).toHaveBeenCalledWith([ID]);
    });

    it('devuelve null si el servicio no existe', async () => {
      expect(await montar(jest.fn()).nombreDelServicio(ID)).toBeNull();
    });

    it('devuelve null si falla la consulta, sin lanzar', async () => {
      const find = jest.fn().mockRejectedValue(new Error('BD caída'));
      await expect(
        montar(jest.fn(), find).nombreDelServicio(ID),
      ).resolves.toBeNull();
    });
  });
});

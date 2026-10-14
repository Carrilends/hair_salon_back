import { Conversation } from './conversation';

/**
 * Plan 06, F3a. Una conversación de WhatsApp se identifica por el número del
 * remitente (firmado por Meta), no por un usuario: nunca se fabrica un `userId`
 * a partir de un teléfono (D1).
 */
describe('Conversation · por teléfono', () => {
  it('nace con el número del remitente y sin usuario', () => {
    const c = Conversation.start({ phoneE164: '573001234567' });

    expect(c.phoneE164).toBe('573001234567');
    expect(c.userId).toBeNull();
  });

  it('la de la web no tiene teléfono', () => {
    expect(Conversation.start({ userId: 'u-1' }).phoneE164).toBeNull();
    expect(Conversation.start({}).phoneE164).toBeNull();
  });

  it('rechaza nacer con usuario y teléfono a la vez', () => {
    expect(() =>
      Conversation.start({ userId: 'u-1', phoneE164: '573001234567' }),
    ).toThrow();
  });

  it('conserva el teléfono al rehidratarse', () => {
    const c = Conversation.fromPersistence({
      id: 'c-1',
      phoneE164: '573001234567',
    });

    expect(c.phoneE164).toBe('573001234567');
  });

  it('una conversación por teléfono no se puede reclamar por un usuario web', () => {
    const c = Conversation.start({ phoneE164: '573001234567' });

    c.claimBy('u-1');

    expect(c.userId).toBeNull();
  });
});

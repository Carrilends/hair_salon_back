import { actorDelContexto, contactoDeWhatsApp } from './identidad';
import { AssistantContext } from './assistant-tool';

const ahora = new Date('2026-10-14T15:00:00Z');
const ctx = (over: Partial<AssistantContext>): AssistantContext => ({
  userId: null,
  isAdmin: false,
  now: ahora,
  ...over,
});

/**
 * Plan 06, F3b. Quién actúa sobre una reserva, deducido SOLO del contexto (que
 * fija el borde: JWT en la web, firma de Meta en WhatsApp). Nunca de los
 * argumentos del modelo.
 */
describe('actorDelContexto', () => {
  it('web: usuario con sesión → user; sin sesión → nadie', () => {
    expect(actorDelContexto(ctx({ userId: 'u-1' }))).toEqual({
      kind: 'user',
      userId: 'u-1',
    });
    expect(actorDelContexto(ctx({}))).toBeNull();
  });

  it('web: administración con sesión → admin; sin sesión, ni siquiera con isAdmin → nadie', () => {
    expect(actorDelContexto(ctx({ userId: 'a-1', isAdmin: true }))).toEqual({
      kind: 'admin',
    });
    expect(actorDelContexto(ctx({ isAdmin: true }))).toBeNull();
  });

  it('WhatsApp: la clienta actúa con su número firmado', () => {
    expect(
      actorDelContexto(ctx({ canal: 'whatsapp', phoneE164: '573001112233' })),
    ).toEqual({ kind: 'phone', phoneE164: '573001112233' });
  });

  it('WhatsApp: la dueña actúa como administración', () => {
    expect(
      actorDelContexto(
        ctx({ canal: 'whatsapp', phoneE164: '573208977471', isAdmin: true }),
      ),
    ).toEqual({ kind: 'admin' });
  });

  it('WhatsApp sin número → nadie (nunca se cae a la identidad web)', () => {
    expect(
      actorDelContexto(ctx({ canal: 'whatsapp', userId: 'u-1' })),
    ).toBeNull();
  });

  it('un número fuera de WhatsApp no vale como identidad', () => {
    expect(actorDelContexto(ctx({ phoneE164: '573001112233' }))).toBeNull();
  });
});

describe('contactoDeWhatsApp', () => {
  it('nombre recortado y el número firmado como teléfono', () => {
    expect(
      contactoDeWhatsApp(
        ctx({ canal: 'whatsapp', phoneE164: '573001112233' }),
        '  Ana María ',
      ),
    ).toEqual({ name: 'Ana María', phone: '573001112233' });
  });

  it.each([
    ['sin nombre', ctx({ canal: 'whatsapp', phoneE164: '573001112233' }), ''],
    [
      'nombre que no es texto',
      ctx({ canal: 'whatsapp', phoneE164: '573001112233' }),
      42,
    ],
    [
      'nombre larguísimo',
      ctx({ canal: 'whatsapp', phoneE164: '573001112233' }),
      'x'.repeat(81),
    ],
    ['fuera de WhatsApp', ctx({ phoneE164: '573001112233' }), 'Ana'],
    [
      'la dueña (no crea)',
      ctx({ canal: 'whatsapp', phoneE164: '573208977471', isAdmin: true }),
      'Ana',
    ],
  ])('null %s', (_caso, c, nombre) => {
    expect(contactoDeWhatsApp(c, nombre)).toBeNull();
  });
});

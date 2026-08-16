import { RequestPasswordResetUseCase } from './request-password-reset.use-case';

const now = new Date('2026-08-04T10:00:00.000Z');
const links = {
  resetPasswordUrl: 'https://front/auth/restablecer',
  verifyEmailUrl: 'https://front/auth/verificar-correo',
};

function deps(user: any) {
  const sent: any[] = [];
  const saved: any[] = [];
  const invalidated: any[] = [];
  return {
    sent,
    saved,
    invalidated,
    uc: new RequestPasswordResetUseCase(
      { findByEmail: async () => user } as any,
      {
        save: async (t: any) => {
          saved.push(t);
          return t;
        },
        invalidateAllOfType: async (id: string, type: string) => {
          invalidated.push({ id, type });
        },
        findByHash: async () => null,
      } as any,
      {
        generate: () => ({ raw: 'raw-1', hash: 'hash-1' }),
        hash: () => 'hash-1',
      } as any,
      {
        send: async (m: any) => {
          sent.push(m);
        },
      } as any,
      { now: () => now } as any,
      links as any,
    ),
  };
}

describe('RequestPasswordResetUseCase', () => {
  it('emite token, invalida los anteriores y envía el enlace', async () => {
    const d = deps({
      id: 'u-1',
      email: { value: 'a@b.com' },
      fullName: 'Ana',
      isActive: true,
    });
    await d.uc.execute('A@B.com');
    expect(d.invalidated[0]).toEqual({ id: 'u-1', type: 'password_reset' });
    expect(d.saved).toHaveLength(1);
    expect(d.sent[0].text).toContain('raw-1');
  });

  it('no revela si la cuenta existe: no lanza ni envía nada', async () => {
    const d = deps(null);
    await expect(d.uc.execute('desconocido@b.com')).resolves.toBeUndefined();
    expect(d.sent).toHaveLength(0);
  });

  it('tolera un correo con formato inválido sin filtrar información', async () => {
    const d = deps(null);
    await expect(d.uc.execute('no-es-correo')).resolves.toBeUndefined();
  });
});

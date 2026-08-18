import { LogoutUseCase } from './logout.use-case';
import { LogoutAllUseCase } from './logout-all.use-case';
import { RefreshToken } from '../domain/refresh-token';

const now = new Date('2026-08-04T10:00:00.000Z');
const issuer = { hashRefreshToken: (r: string) => `h-${r}` } as any;
const clock = { now: () => now } as any;

describe('LogoutUseCase', () => {
  it('revoca el token presentado (revocación limpia, no reuso)', async () => {
    const stored = RefreshToken.issue({
      userId: 'u-1',
      tokenHash: 'h-raw',
      now,
      ttlDays: 30,
    });
    const saved: RefreshToken[] = [];
    const repo = {
      findByHash: async () => stored,
      save: async (t: RefreshToken) => {
        saved.push(t);
        return t;
      },
    } as any;

    await new LogoutUseCase(repo, issuer, clock).execute('raw');

    expect(saved).toHaveLength(1);
    expect(saved[0].revokedAt).toEqual(now);
    expect(saved[0].replacedByHash).toBeNull(); // no es rotación → no dispara reuso
  });

  it('no falla si el token ya no existe', async () => {
    const repo = {
      findByHash: async () => null,
      save: async () => undefined,
    } as any;
    await expect(
      new LogoutUseCase(repo, issuer, clock).execute('raw'),
    ).resolves.toBeUndefined();
  });
});

describe('LogoutAllUseCase', () => {
  it('revoca todas las sesiones del usuario', async () => {
    const calls: any[] = [];
    const repo = {
      revokeAllOfUser: async (userId: string, at: Date) => {
        calls.push({ userId, at });
        return 3;
      },
    } as any;

    const revoked = await new LogoutAllUseCase(repo, clock).execute('u-1');

    expect(revoked).toBe(3);
    expect(calls).toEqual([{ userId: 'u-1', at: now }]);
  });
});

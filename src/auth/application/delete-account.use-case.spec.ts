import { DeleteAccountUseCase } from './delete-account.use-case';
import { FailedAttemptLimiter } from './failed-attempt-limiter';
import {
  AccountDeletionConfirmationError,
  AdminAccountDeletionError,
  TooManyAttemptsError,
  UserNotFoundError,
} from '../domain/errors';
import { UserAccount } from '../domain/user-account';
import { Email } from '../domain/email';

const AHORA = new Date('2026-10-28T15:00:00.000Z');

function account(overrides: any = {}) {
  return UserAccount.fromPersistence({
    id: 'u-1',
    email: Email.create('ana@correo.test'),
    passwordHash: 'stored-hash',
    fullName: 'Ana Prueba',
    roles: ['user'],
    isActive: true,
    emailVerifiedAt: null,
    dataPolicyAcceptedAt: null,
    ...overrides,
  });
}

function deps({
  user = account(),
  compare = async (plano: string) => plano === 'Correcta-1',
  limiter = new FailedAttemptLimiter(5, 15 * 60_000),
  now = () => AHORA,
  locked = {
    fullName: 'Ana (fila bloqueada)',
    email: 'ana.bloqueada@correo.test',
    roles: ['user'],
  } as { fullName: string; email: string; roles: string[] } | null,
}: {
  locked?: { fullName: string; email: string; roles: string[] } | null;
  user?: UserAccount | null;
  compare?: (plano: string, hash: string) => Promise<boolean>;
  limiter?: FailedAttemptLimiter;
  now?: () => Date;
} = {}) {
  const llamadas: { paso: string; tx: unknown; args: unknown[] }[] = [];
  const TX = { soy: 'la-transaccion' };
  const anotar =
    (paso: string, valor: unknown) =>
    async (tx: unknown, ...args: unknown[]) => {
      llamadas.push({ paso, tx, args });
      return valor;
    };
  const users = {
    findById: jest.fn(async () => user),
    lockForDeletion: jest.fn(anotar('lock', locked)),
    deleteWithin: jest.fn(anotar('delete', undefined)),
  };
  const hasher = { compare: jest.fn(compare) };
  const unitOfWork = {
    run: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(TX)),
  };
  const reservations = {
    handOverAndDetach: jest.fn(
      anotar('reservations', { vigentes: 2, detached: 3 }),
    ),
  };
  const reviews = { anonymize: jest.fn(anotar('reviews', 1)) };
  const assistant = { purge: jest.fn(anotar('assistant', 1)) };
  const uc = new DeleteAccountUseCase(
    users as any,
    hasher as any,
    unitOfWork as any,
    reservations as any,
    reviews as any,
    assistant as any,
    { now } as any,
    limiter,
  );
  return {
    uc,
    users,
    hasher,
    unitOfWork,
    reservations,
    reviews,
    assistant,
    llamadas,
    TX,
  };
}

function nadaTocado(d: ReturnType<typeof deps>) {
  expect(d.unitOfWork.run).not.toHaveBeenCalled();
  expect(d.users.lockForDeletion).not.toHaveBeenCalled();
  expect(d.users.deleteWithin).not.toHaveBeenCalled();
  expect(d.reservations.handOverAndDetach).not.toHaveBeenCalled();
  expect(d.reviews.anonymize).not.toHaveBeenCalled();
  expect(d.assistant.purge).not.toHaveBeenCalled();
}

describe('DeleteAccountUseCase', () => {
  it('una cuenta admin no puede borrarse: error de dominio y ningún puerto llamado', async () => {
    const d = deps({ user: account({ roles: ['admin'] }) });
    await expect(
      d.uc.execute('u-1', { password: 'Correcta-1' }),
    ).rejects.toThrow(AdminAccountDeletionError);
    nadaTocado(d);
    // Ni siquiera se compara la contraseña.
    expect(d.hasher.compare).not.toHaveBeenCalled();
  });

  it('admin con más roles tampoco', async () => {
    const d = deps({ user: account({ roles: ['user', 'admin'] }) });
    await expect(
      d.uc.execute('u-1', { password: 'Correcta-1' }),
    ).rejects.toThrow(AdminAccountDeletionError);
    nadaTocado(d);
  });

  it('contraseña mala: credenciales inválidas y nada tocado', async () => {
    const d = deps();
    await expect(d.uc.execute('u-1', { password: 'Mala-1' })).rejects.toThrow(
      AccountDeletionConfirmationError,
    );
    nadaTocado(d);
  });

  it('cuenta con contraseña sin contraseña en el cuerpo: 401', async () => {
    const d = deps();
    await expect(d.uc.execute('u-1', {})).rejects.toThrow(
      AccountDeletionConfirmationError,
    );
    expect(d.hasher.compare).not.toHaveBeenCalled();
    nadaTocado(d);
  });

  it('cuenta con contraseña a la que se le manda solo el correo: 401', async () => {
    const d = deps({ user: account({ googleId: 'g-1' }) });
    await expect(
      d.uc.execute('u-1', { email: 'ana@correo.test' }),
    ).rejects.toThrow(AccountDeletionConfirmationError);
    nadaTocado(d);
  });

  it('cuenta de Google: el correo en mayúsculas y con espacios alrededor pasa', async () => {
    const d = deps({ user: account({ passwordHash: null, googleId: 'g-1' }) });
    await d.uc.execute('u-1', { email: '  ANA@Correo.TEST \t' });
    expect(d.hasher.compare).not.toHaveBeenCalled();
    expect(d.users.deleteWithin).toHaveBeenCalled();
  });

  it('cuenta de Google con otro correo: 401 y nada tocado', async () => {
    const d = deps({ user: account({ passwordHash: null, googleId: 'g-1' }) });
    await expect(
      d.uc.execute('u-1', { email: 'otra@correo.test' }),
    ).rejects.toThrow(AccountDeletionConfirmationError);
    nadaTocado(d);
  });

  it('cuenta de Google sin correo en el cuerpo: 401', async () => {
    const d = deps({ user: account({ passwordHash: null, googleId: 'g-1' }) });
    await expect(
      d.uc.execute('u-1', { password: 'Correcta-1' }),
    ).rejects.toThrow(AccountDeletionConfirmationError);
    nadaTocado(d);
  });

  it('camino feliz: los tres puertos y el borrado, en ese orden y con el mismo tx', async () => {
    const d = deps();
    const r = await d.uc.execute('u-1', { password: 'Correcta-1' });

    expect(d.unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(d.llamadas.map((l) => l.paso)).toEqual([
      'lock',
      'reservations',
      'reviews',
      'assistant',
      'delete',
    ]);
    for (const l of d.llamadas) expect(l.tx).toBe(d.TX);

    expect(d.llamadas[0].args).toEqual(['u-1']);
    expect(d.llamadas[1].args).toEqual([
      'u-1',
      // Nombre y correo salen de la fila bloqueada, no de la lectura previa.
      { fullName: 'Ana (fila bloqueada)', email: 'ana.bloqueada@correo.test' },
      AHORA,
    ]);
    expect(d.llamadas[2].args).toEqual(['u-1']);
    expect(d.llamadas[3].args).toEqual(['u-1']);
    expect(d.llamadas[4].args).toEqual(['u-1']);
    expect(r).toEqual({
      reservasVigentes: 2,
      reservasDesvinculadas: 3,
      resenasAnonimizadas: 1,
      conversacionesBorradas: 1,
    });
  });

  it('si un puerto falla, el error sube (la unidad de trabajo revierte) y no hay borrado', async () => {
    const d = deps();
    d.reviews.anonymize.mockRejectedValueOnce(new Error('caída'));
    await expect(
      d.uc.execute('u-1', { password: 'Correcta-1' }),
    ).rejects.toThrow('caída');
    expect(d.assistant.purge).not.toHaveBeenCalled();
    expect(d.users.deleteWithin).not.toHaveBeenCalled();
  });

  it('si la fila bloqueada ya es admin (ascenso en paralelo): 403 y no se toca nada más', async () => {
    const d = deps({
      locked: {
        fullName: 'Ana',
        email: 'ana@correo.test',
        roles: ['user', 'admin'],
      },
    });
    await expect(
      d.uc.execute('u-1', { password: 'Correcta-1' }),
    ).rejects.toThrow(AdminAccountDeletionError);
    expect(d.llamadas.map((l) => l.paso)).toEqual(['lock']);
  });

  it('si la cuenta desapareció antes del bloqueo: no encontrada y nada más', async () => {
    const d = deps({ locked: null });
    await expect(
      d.uc.execute('u-1', { password: 'Correcta-1' }),
    ).rejects.toThrow(UserNotFoundError);
    expect(d.llamadas.map((l) => l.paso)).toEqual(['lock']);
  });

  describe('límite de intentos (5 fallidos en 15 minutos por cuenta)', () => {
    it('tras 5 fallidos el sexto da 429 aunque la contraseña sea la buena, y no compara', async () => {
      const d = deps();
      for (let i = 0; i < 5; i++) {
        await expect(
          d.uc.execute('u-1', { password: 'Mala-1' }),
        ).rejects.toThrow(AccountDeletionConfirmationError);
      }
      d.hasher.compare.mockClear();
      await expect(
        d.uc.execute('u-1', { password: 'Correcta-1' }),
      ).rejects.toThrow(TooManyAttemptsError);
      expect(d.hasher.compare).not.toHaveBeenCalled();
      nadaTocado(d);
    });

    it('4 fallidos no bloquean: el quinto intento, si es bueno, borra', async () => {
      const d = deps();
      for (let i = 0; i < 4; i++) {
        await expect(
          d.uc.execute('u-1', { password: 'Mala-1' }),
        ).rejects.toThrow(AccountDeletionConfirmationError);
      }
      await d.uc.execute('u-1', { password: 'Correcta-1' });
      expect(d.users.deleteWithin).toHaveBeenCalled();
    });

    it('el bloqueo se levanta cuando pasan los 15 minutos', async () => {
      let ahora = AHORA.getTime();
      const d = deps({ now: () => new Date(ahora) });
      for (let i = 0; i < 5; i++) {
        await expect(
          d.uc.execute('u-1', { password: 'Mala-1' }),
        ).rejects.toThrow(AccountDeletionConfirmationError);
      }
      ahora += 15 * 60_000 + 1;
      await d.uc.execute('u-1', { password: 'Correcta-1' });
      expect(d.users.deleteWithin).toHaveBeenCalled();
    });

    it('el límite es por cuenta: los fallos de otra no bloquean', async () => {
      const limiter = new FailedAttemptLimiter(5, 15 * 60_000);
      const otra = deps({ user: account({ id: 'u-2' }), limiter });
      for (let i = 0; i < 5; i++) {
        await expect(
          otra.uc.execute('u-2', { password: 'Mala-1' }),
        ).rejects.toThrow(AccountDeletionConfirmationError);
      }
      const d = deps({ limiter });
      await d.uc.execute('u-1', { password: 'Correcta-1' });
      expect(d.users.deleteWithin).toHaveBeenCalled();
    });

    it('en paralelo no se consiguen más intentos: 10 a la vez dan 5 comparaciones y 5 «429»', async () => {
      let soltar!: () => void;
      const puerta = new Promise<void>((r) => (soltar = r));
      const d = deps({
        // La comparación tarda: todas las peticiones están en vuelo a la vez.
        compare: async () => {
          await puerta;
          return false;
        },
      });
      const vuelo = Array.from({ length: 10 }, () =>
        d.uc.execute('u-1', { password: 'Mala-1' }).then(
          () => 'ok',
          (e: Error) => e.constructor.name,
        ),
      );
      soltar();
      const res = await Promise.all(vuelo);
      expect(d.hasher.compare).toHaveBeenCalledTimes(5);
      expect(res.filter((x) => x === 'TooManyAttemptsError')).toHaveLength(5);
      expect(
        res.filter((x) => x === 'AccountDeletionConfirmationError'),
      ).toHaveLength(5);
      nadaTocado(d);
    });

    it('un acierto devuelve el intento reservado: no cuenta como fallo', async () => {
      const limiter = new FailedAttemptLimiter(5, 15 * 60_000);
      const d = deps({ limiter });
      for (let i = 0; i < 4; i++) {
        await expect(
          d.uc.execute('u-1', { password: 'Mala-1' }),
        ).rejects.toThrow(AccountDeletionConfirmationError);
      }
      // La transacción falla tras confirmar: el acierto no gasta el quinto.
      d.unitOfWork.run.mockRejectedValueOnce(new Error('caída'));
      await expect(
        d.uc.execute('u-1', { password: 'Correcta-1' }),
      ).rejects.toThrow('caída');
      expect(limiter.isBlocked('u-1', AHORA)).toBe(false);
    });

    it('un intento de admin no cuenta como fallido', async () => {
      const limiter = new FailedAttemptLimiter(5, 15 * 60_000);
      const admin = deps({ user: account({ roles: ['admin'] }), limiter });
      for (let i = 0; i < 6; i++) {
        await expect(
          admin.uc.execute('u-1', { password: 'Mala-1' }),
        ).rejects.toThrow(AdminAccountDeletionError);
      }
      expect(limiter.isBlocked('u-1', AHORA)).toBe(false);
    });
  });
});

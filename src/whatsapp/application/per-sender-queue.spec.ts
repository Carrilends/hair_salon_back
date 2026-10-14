import { PerSenderQueue } from './per-sender-queue';

/** Promesa que se resuelve a mano: así la prueba decide el orden. */
function diferida() {
  let resolver!: () => void;
  let rechazar!: (e: Error) => void;
  const promesa = new Promise<void>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

const vaciar = () => new Promise((r) => setImmediate(r));

describe('PerSenderQueue (plan 06, F2)', () => {
  it('los mensajes de un mismo número se procesan en serie y en orden', async () => {
    const cola = new PerSenderQueue();
    const orden: string[] = [];
    const primero = diferida();

    const a = cola.run('573001', async () => {
      orden.push('a:empieza');
      await primero.promesa;
      orden.push('a:termina');
    });
    const b = cola.run('573001', async () => {
      orden.push('b:empieza');
    });

    await vaciar();
    // `b` espera a que termine `a`, aunque `a` esté parado.
    expect(orden).toEqual(['a:empieza']);

    primero.resolver();
    await Promise.all([a, b]);
    expect(orden).toEqual(['a:empieza', 'a:termina', 'b:empieza']);
  });

  it('los de números distintos no se esperan entre sí', async () => {
    const cola = new PerSenderQueue();
    const orden: string[] = [];
    const bloqueo = diferida();

    const a = cola.run('573001', async () => {
      orden.push('a:empieza');
      await bloqueo.promesa;
    });
    const b = cola.run('573002', async () => {
      orden.push('b:empieza');
    });

    await b;
    expect(orden).toEqual(['a:empieza', 'b:empieza']);
    bloqueo.resolver();
    await a;
  });

  it('un fallo no bloquea al siguiente del mismo número, y llega a quien lo lanzó', async () => {
    const cola = new PerSenderQueue();
    const orden: string[] = [];

    const a = cola.run('573001', async () => {
      throw new Error('falló');
    });
    const b = cola.run('573001', async () => {
      orden.push('b');
    });

    await expect(a).rejects.toThrow('falló');
    await b;
    expect(orden).toEqual(['b']);
  });

  it('no acumula números ya atendidos (sin fuga de memoria)', async () => {
    const cola = new PerSenderQueue();

    await cola.run('573001', async () => undefined);
    await cola
      .run('573002', async () => {
        throw new Error('x');
      })
      .catch(() => undefined);
    await vaciar();

    expect(cola.pendientes).toBe(0);
  });
});

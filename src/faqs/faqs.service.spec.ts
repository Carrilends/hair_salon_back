import { BadRequestException } from '@nestjs/common';
import { FaqsService, ORDEN_DESACTUALIZADO } from './faqs.service';

const A = '3f1c2b9e-8a4d-4c1e-9b7a-1d2e3f4a5b6c';
const B = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const C = 'c0ffee00-1234-4abc-8def-0123456789ab';
const D = 'd15ea5e0-5678-4abc-9def-abcdef012345';

type Fila = { id: string; sortOrder: number };

/**
 * Doble de la base. El repositorio de la transacción guarda las filas en
 * memoria: `update` las cambia de verdad y la lectura final las devuelve
 * ordenadas, así que la prueba mide el resultado y no solo las llamadas.
 */
function baseFalsa(inicial: Fila[]) {
  const filas = inicial.map((fila) => ({
    ...fila,
    question: `Pregunta ${fila.id.slice(0, 4)}`,
    answer: 'Una respuesta.',
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));

  const repoTransaccion = {
    find: jest.fn(async (opciones?: { lock?: unknown }) =>
      opciones?.lock
        ? filas.map(({ id, sortOrder }) => ({ id, sortOrder }))
        : [...filas].sort((a, b) => a.sortOrder - b.sortOrder),
    ),
    update: jest.fn(
      async (criterio: { id: string }, cambios: { sortOrder: number }) => {
        const fila = filas.find((f) => f.id === criterio.id);
        if (fila) fila.sortOrder = cambios.sortOrder;
        return { affected: fila ? 1 : 0 };
      },
    ),
  };

  const transaction = jest.fn(
    async (trabajo: (manager: unknown) => Promise<unknown>) =>
      trabajo({ getRepository: () => repoTransaccion }),
  );

  const faqRepository = {
    manager: { transaction },
    create: jest.fn((datos: object) => datos),
    save: jest.fn(async (datos: object) => datos),
    maximum: jest.fn(),
  };

  return {
    service: new FaqsService(faqRepository as any),
    repoTransaccion,
    transaction,
    faqRepository,
  };
}

describe('FaqsService.reordenar', () => {
  it('reescribe los puestos 0..n-1 en el orden pedido y devuelve la lista ordenada', async () => {
    const { service, transaction } = baseFalsa([
      { id: A, sortOrder: 0 },
      { id: B, sortOrder: 1 },
      { id: C, sortOrder: 2 },
    ]);

    const lista = await service.reordenar([C, A, B]);

    expect(lista.map((faq) => faq.id)).toEqual([C, A, B]);
    expect(lista.map((faq) => faq.sortOrder)).toEqual([0, 1, 2]);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('solo escribe las filas que cambian de puesto', async () => {
    const { service, repoTransaccion } = baseFalsa([
      { id: A, sortOrder: 0 },
      { id: B, sortOrder: 1 },
      { id: C, sortOrder: 2 },
    ]);

    await service.reordenar([A, C, B]);

    expect(repoTransaccion.update).toHaveBeenCalledTimes(2);
    expect(repoTransaccion.update).toHaveBeenCalledWith(
      { id: C },
      { sortOrder: 1 },
    );
    expect(repoTransaccion.update).toHaveBeenCalledWith(
      { id: B },
      { sortOrder: 2 },
    );
  });

  /** Hasta hoy toda pregunta nueva entraba con 0: hay puestos repetidos y huecos. */
  it('deja puestos consecutivos aunque la base traiga repetidos y huecos', async () => {
    const { service } = baseFalsa([
      { id: A, sortOrder: 0 },
      { id: B, sortOrder: 0 },
      { id: C, sortOrder: 7 },
    ]);

    const lista = await service.reordenar([A, B, C]);

    expect(lista.map((faq) => faq.sortOrder)).toEqual([0, 1, 2]);
  });

  it('bloquea las filas al leerlas, para que dos órdenes no se crucen', async () => {
    const { service, repoTransaccion } = baseFalsa([
      { id: A, sortOrder: 0 },
      { id: B, sortOrder: 1 },
    ]);

    await service.reordenar([B, A]);

    expect(repoTransaccion.find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it.each([
    ['falta una', [A, B]],
    ['sobra una que no existe', [A, B, C, D]],
    ['cambia una por otra', [A, B, D]],
    ['se repite una aunque el tamaño cuadre', [A, A, B]],
  ])('responde 400 sin escribir nada si %s', async (_caso, ids) => {
    const { service, repoTransaccion } = baseFalsa([
      { id: A, sortOrder: 0 },
      { id: B, sortOrder: 1 },
      { id: C, sortOrder: 2 },
    ]);

    const intento = service.reordenar(ids);

    await expect(intento).rejects.toBeInstanceOf(BadRequestException);
    await expect(intento).rejects.toThrow(ORDEN_DESACTUALIZADO);
    expect(repoTransaccion.update).not.toHaveBeenCalled();
  });
});

describe('FaqsService.create', () => {
  const cuerpo = {
    question: '  ¿Hay parqueadero cerca?  ',
    answer: '  Sí, sobre la misma calle.  ',
  };

  it('sin orden explícito, la pregunta nueva entra al final', async () => {
    const { service, faqRepository } = baseFalsa([]);
    faqRepository.maximum.mockResolvedValue(4);

    await service.create(cuerpo);

    expect(faqRepository.maximum).toHaveBeenCalledWith('sortOrder');
    expect(faqRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 5 }),
    );
  });

  it('con la tabla vacía empieza en 0', async () => {
    const { service, faqRepository } = baseFalsa([]);
    faqRepository.maximum.mockResolvedValue(null);

    await service.create(cuerpo);

    expect(faqRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 0 }),
    );
  });

  it('respeta un orden explícito y entonces no consulta el máximo', async () => {
    const { service, faqRepository } = baseFalsa([]);

    await service.create({ ...cuerpo, sortOrder: 2 });

    expect(faqRepository.maximum).not.toHaveBeenCalled();
    expect(faqRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 2 }),
    );
  });

  it('sigue recortando los espacios de pregunta y respuesta', async () => {
    const { service, faqRepository } = baseFalsa([]);
    faqRepository.maximum.mockResolvedValue(null);

    await service.create(cuerpo);

    expect(faqRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        question: '¿Hay parqueadero cerca?',
        answer: 'Sí, sobre la misma calle.',
      }),
    );
  });
});

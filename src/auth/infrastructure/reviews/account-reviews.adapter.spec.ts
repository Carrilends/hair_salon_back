import { In } from 'typeorm';
import { Review } from 'src/reviews/entities/review.entity';
import { ReviewByUser } from 'src/reviews/entities/review-by-user.entity';
import { AccountReviewsAdapter } from './account-reviews.adapter';

/** El `EntityManager` de la transacción, simulado con los dos repositorios. */
function txCon(vinculos: Partial<ReviewByUser>[]) {
  const resenas = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
  const porUsuario = {
    find: jest.fn().mockResolvedValue(vinculos),
    delete: jest.fn().mockResolvedValue({ affected: vinculos.length }),
  };
  const tx = {
    getRepository: jest.fn((entidad: unknown) => {
      if (entidad === Review) return resenas;
      if (entidad === ReviewByUser) return porUsuario;
      throw new Error('repositorio inesperado');
    }),
  };
  return { tx, resenas, porUsuario };
}

function vinculo(id: string, reviewId: string): Partial<ReviewByUser> {
  return { id, review: { id: reviewId } as Review };
}

describe('AccountReviewsAdapter.anonymize', () => {
  const sut = new AccountReviewsAdapter();

  it('busca los vínculos de la cuenta a través del tx', async () => {
    const { tx, porUsuario } = txCon([]);

    await sut.anonymize(tx as never, 'u-1');

    const opciones = porUsuario.find.mock.calls[0][0];
    expect(opciones.where).toEqual({ user: { id: 'u-1' } });
    expect(opciones.relations).toEqual({ review: true });
  });

  it('las reseñas quedan con «Clienta del salón» y sin vínculo', async () => {
    const { tx, resenas, porUsuario } = txCon([
      vinculo('v-1', 'rev-1'),
      vinculo('v-2', 'rev-2'),
    ]);

    const n = await sut.anonymize(tx as never, 'u-1');

    expect(resenas.update).toHaveBeenCalledWith(
      { id: In(['rev-1', 'rev-2']) },
      { name: 'Clienta del salón' },
    );
    expect(porUsuario.delete).toHaveBeenCalledWith({ id: In(['v-1', 'v-2']) });
    expect(n).toBe(2);
  });

  it('no toca el texto ni la calificación', async () => {
    const { tx, resenas } = txCon([vinculo('v-1', 'rev-1')]);

    await sut.anonymize(tx as never, 'u-1');

    expect(Object.keys(resenas.update.mock.calls[0][1])).toEqual(['name']);
  });

  it('sin reseñas no escribe nada', async () => {
    const { tx, resenas, porUsuario } = txCon([]);

    const n = await sut.anonymize(tx as never, 'u-1');

    expect(resenas.update).not.toHaveBeenCalled();
    expect(porUsuario.delete).not.toHaveBeenCalled();
    expect(n).toBe(0);
  });
});

import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Review } from 'src/reviews/entities/review.entity';
import { ReviewByUser } from 'src/reviews/entities/review-by-user.entity';
import { ANONYMOUS_REVIEW_NAME } from '../../domain/account-deletion';
import { AccountReviewsPort } from '../../domain/ports/account-reviews.port';

/**
 * Anonimiza las reseñas de una cuenta que se elimina. Usa solo el `tx`
 * recibido. Borra los vínculos aquí y no con una migración: `reviewsByUser.userId`
 * no tiene `ON DELETE`, así que sin este paso el borrado del usuario fallaría.
 */
@Injectable()
export class AccountReviewsAdapter implements AccountReviewsPort {
  async anonymize(tx: EntityManager, userId: string): Promise<number> {
    const vinculos = tx.getRepository(ReviewByUser);
    const filas = await vinculos.find({
      where: { user: { id: userId } },
      relations: { review: true },
    });
    if (filas.length === 0) return 0;

    const reviewIds = filas
      .map((f) => f.review?.id)
      .filter((id): id is string => Boolean(id));
    if (reviewIds.length > 0) {
      await tx
        .getRepository(Review)
        .update({ id: In(reviewIds) }, { name: ANONYMOUS_REVIEW_NAME });
    }
    await vinculos.delete({ id: In(filas.map((f) => f.id)) });
    return reviewIds.length;
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from 'src/reviews/entities/review.entity';
import { ReviewByUser } from 'src/reviews/entities/review-by-user.entity';
import { ReviewAuthorRenamerPort } from '../../domain/ports/review-author-renamer.port';

/**
 * Traslada aquí el bloque que hoy vive en `AuthService#updateProfile`: propaga
 * el nombre nuevo del autor a todas sus reseñas. Es el único punto donde Auth
 * toca el contexto de Reviews, a través del puerto.
 */
@Injectable()
export class ReviewAuthorRenamerAdapter implements ReviewAuthorRenamerPort {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(ReviewByUser)
    private readonly reviewByUserRepository: Repository<ReviewByUser>,
  ) {}

  async rename(userId: string, newFullName: string): Promise<void> {
    const reviewsByUser = await this.reviewByUserRepository.find({
      where: { user: { id: userId } },
      relations: ['review'],
    });
    if (reviewsByUser.length === 0) return;

    const reviewsToUpdate = reviewsByUser
      .map((relation) => relation.review)
      .filter((review): review is Review => Boolean(review))
      .map((review) => {
        review.name = newFullName;
        return review;
      });

    if (reviewsToUpdate.length > 0) {
      await this.reviewRepository.save(reviewsToUpdate);
    }
  }
}

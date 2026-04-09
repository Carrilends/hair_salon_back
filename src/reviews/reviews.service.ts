import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateReviewDto } from './dto/create-review.dto';
import { Review } from './entities/review.entity';
import { ReviewByUser } from './entities/review-by-user.entity';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(ReviewByUser)
    private readonly reviewByUserRepository: Repository<ReviewByUser>,
  ) {}

  async create(createReviewDto: CreateReviewDto, user: User) {
    if ((user.roles ?? []).includes('admin')) {
      throw new ForbiddenException('Admin users cannot create reviews');
    }

    const review = this.reviewRepository.create({
      ...createReviewDto,
      name: createReviewDto.name.trim(),
      description: createReviewDto.description.trim(),
    });

    const savedReview = await this.reviewRepository.save(review);

    const relation = this.reviewByUserRepository.create({
      user,
      review: savedReview,
    });
    await this.reviewByUserRepository.save(relation);

    return {
      ...savedReview,
      userId: user.id,
    };
  }

  async findAll() {
    return this.reviewRepository.find({
      order: { createdAt: 'DESC' },
    });
  }
}

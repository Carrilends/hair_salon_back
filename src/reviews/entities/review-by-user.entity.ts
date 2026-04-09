import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from 'src/auth/entities/user.entity';
import { Review } from './review.entity';

@Entity('reviewsByUser')
@Unique(['user', 'review'])
export class ReviewByUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.reviewsByUser, { nullable: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Review, (review) => review.reviewsByUser, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reviewId' })
  review: Review;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}

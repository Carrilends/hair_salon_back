import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReviewByUser } from 'src/reviews/entities/review-by-user.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', {
    unique: true,
    nullable: false,
  })
  email: string;

  @Column('text', {
    nullable: false,
    select: false,
  })
  password: string;

  @Column('text', { nullable: false })
  fullName: string;

  @Column('text', {
    nullable: false,
    array: true,
    default: ['user'],
  })
  roles: string[];

  @Column('boolean', { default: true })
  isActive: boolean;

  @OneToMany(() => ReviewByUser, (reviewByUser) => reviewByUser.user)
  reviewsByUser: ReviewByUser[];

  @BeforeInsert()
  emailToLowerCase() {
    this.email = this.email.toLowerCase().trim();
  }
  @BeforeUpdate()
  emailToLowerCaseOnUpdate() {
    this.email = this.email.toLowerCase().trim();
  }
}

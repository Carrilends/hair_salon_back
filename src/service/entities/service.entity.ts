import { Detail } from 'src/detail/entities/detail.entity';
import { ImageManager } from 'src/images/images.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', {
    nullable: false,
    unique: true,
  })
  name: string;

  @Column('text')
  gender: string;

  @Column('text')
  type: string;

  @Column('numeric', { nullable: false })
  price: number;

  @Column('boolean', { default: false })
  isSpecial: boolean;

  @Column('text', { unique: true })
  slug: string;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @OneToMany(() => ImageManager, (image) => image.service, { cascade: true })
  images?: ImageManager[];

  @OneToOne(() => Detail, (detail) => detail.service, { cascade: true })
  @JoinColumn()
  detail: Detail;

  @BeforeInsert()
  checkSlugInsert() {
    if (!this.slug) {
      this.slug = this.name.toLowerCase().replaceAll(' ', '_');
    }
  }
  @BeforeUpdate()
  checkSlugUpdate() {
    this.slug = this.slug.toLowerCase().replaceAll(' ', '_');
  }
}

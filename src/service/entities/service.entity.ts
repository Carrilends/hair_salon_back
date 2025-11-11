import { Detail } from 'src/detail/entities/detail.entity';
import { ImageManager } from 'src/images/images.entity';
import { Tag } from 'src/tags/entities/tag.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
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

  @Column('text', { nullable: true })
  type?: string;

  @Column('numeric', { nullable: false })
  price: number;

  @Column('boolean', { default: false })
  isSpecial: boolean;

  @Column('text', { unique: true })
  slug: string;

  @ManyToMany(() => Tag, (tag) => tag.services)
  @JoinTable()
  tags: Tag[];

  @OneToMany(() => ImageManager, (image) => image.service, { cascade: true })
  images?: ImageManager[];

  @Column({ name: 'detail_id' })
  detailId: string;

  @OneToOne(() => Detail, (detail) => detail.service, {
    cascade: true,
  })
  @JoinColumn({ name: 'detail_id' })
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

// https://www.youtube.com/watch?v=_q5-EnV7M_Y

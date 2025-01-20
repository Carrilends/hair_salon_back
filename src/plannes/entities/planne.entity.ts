import { Detail } from 'src/detail/entities/detail.entity';
import { ImageManager } from 'src/images/images.entity';
import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Planne {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', {
    nullable: false,
    unique: true,
  })
  name: string;

  @Column('text', {
    array: true,
    nullable: false,
  })
  servicesIds: string[];

  @Column('text')
  gender: string; // Man, woman, unisex, children

  @OneToMany(() => ImageManager, (image) => image.planne, { cascade: true })
  images?: ImageManager[];

  @OneToOne(() => Detail, (detail) => detail.planne, { cascade: true })
  @JoinColumn()
  detail: Detail;
}

import { Service } from 'src/service/entities/service.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
} from 'typeorm';

@Entity()
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', {
    nullable: false,
    unique: true,
  })
  name: string;

  @ManyToMany(() => Service, (service) => service.tags)
  services: Service[];

  @ManyToOne(() => Tag, (tag) => tag.children, { nullable: true })
  parent: Tag;

  @OneToMany(() => Tag, (tag) => tag.parent)
  children: Tag[];

  @Column({ name: 'parentId', nullable: true })
  parentId: string;
}

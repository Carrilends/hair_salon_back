import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
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

  @ManyToOne(() => Tag, (tag) => tag.children, { nullable: true })
  parent: Tag;

  @OneToMany(() => Tag, (tag) => tag.parent)
  children: Tag[];
}

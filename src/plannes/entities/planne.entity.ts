import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

  // Description
}

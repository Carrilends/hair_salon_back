import { BeforeInsert, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

  // Principal img
  // examples key

  // Detalle key

  @BeforeInsert()
  checkSlugInsert(){
    if (!this.slug) {
      this.slug = this.name.toLowerCase().replaceAll(' ', '_');
    }
  }
}

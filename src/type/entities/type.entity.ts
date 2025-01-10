import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Type {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  translateKey: string;
  // Manicure, pedicure, hair, etc
}

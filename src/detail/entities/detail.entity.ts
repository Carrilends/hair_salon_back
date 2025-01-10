import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Detail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  description: string;

  @Column('jsonb', { nullable: false })
  specifications: any;
  // { facesTypes, etc... }
  // Crear una estructura de JSON por TIPO de servicio
}

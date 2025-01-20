import { Planne } from 'src/plannes/entities/planne.entity';
import { Service } from 'src/service/entities/service.entity';
import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

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

  @OneToOne(() => Service, (service) => service.detail)
  service: Service;

  @OneToOne(() => Planne, (planne) => planne.detail)
  planne: Planne;
}

import { Planne } from 'src/plannes/entities/planne.entity';
import { Service } from 'src/service/entities/service.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ImageManager {
  @PrimaryGeneratedColumn('uuid')
  id: number;

  @Column('text')
  url: string;

  @Column('boolean', { default: false })
  isPrincipal: boolean;

  @ManyToOne(() => Service, (service) => service.images)
  service: Service;

  @ManyToOne(() => Planne, (planne) => planne.images)
  planne: Planne;
}

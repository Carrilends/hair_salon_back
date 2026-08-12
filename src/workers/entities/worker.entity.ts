import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ReservationOrmEntity } from 'src/reservations/infrastructure/persistence/reservation.orm-entity';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { nullable: false })
  name: string;

  @Column('boolean', { name: 'is_default', default: false })
  isDefault: boolean;

  @OneToMany(
    () => ReservationOrmEntity,
    (reservation: ReservationOrmEntity) => reservation.worker,
  )
  reservations?: ReservationOrmEntity[];
}

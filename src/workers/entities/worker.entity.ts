import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Reservation } from 'src/reservations/entities/reservation.entity';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { nullable: false })
  name: string;

  @Column('boolean', { name: 'is_default', default: false })
  isDefault: boolean;

  @OneToMany(
    () => Reservation,
    (reservation: Reservation) => reservation.worker,
  )
  reservations?: Reservation[];
}

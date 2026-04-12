import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { nullable: false })
  name: string;

  @Column('boolean', { name: 'is_default', default: false })
  isDefault: boolean;

  @OneToMany(
    () =>
      require('../../reservations/entities/reservation.entity').Reservation,
    (reservation: import('../../reservations/entities/reservation.entity').Reservation) =>
      reservation.worker,
  )
  reservations?: import('../../reservations/entities/reservation.entity').Reservation[];
}

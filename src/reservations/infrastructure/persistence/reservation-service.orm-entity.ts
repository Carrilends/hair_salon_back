import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReservationOrmEntity } from './reservation.orm-entity';

/**
 * Línea de servicio persistida: snapshot del servicio al momento de reservar.
 * `service_id` es nullable (SET NULL) para preservar el histórico aunque el
 * servicio se elimine del catálogo.
 */
@Entity('reservation_services')
export class ReservationServiceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ReservationOrmEntity, (r) => r.services, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reservation_id' })
  reservation: ReservationOrmEntity;

  @Column('uuid', { name: 'reservation_id' })
  reservationId: string;

  @Column('uuid', { name: 'service_id', nullable: true })
  serviceId: string | null;

  @Column('text')
  name: string;

  @Column('numeric')
  price: number;

  @Column('int', { name: 'duration_minutes' })
  durationMinutes: number;
}

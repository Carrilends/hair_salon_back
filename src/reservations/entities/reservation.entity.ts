import { Worker } from 'src/workers/entities/worker.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz', name: 'scheduled_at' })
  scheduledAt: Date;

  /** `scheduled_at` + `total_duration_minutes` (fin de la ventana de la cita). */
  @Column({ type: 'timestamptz', name: 'ended_at' })
  endedAt: Date;

  @Column('uuid', { name: 'worker_id' })
  workerId: string;

  @ManyToOne(() => Worker, (worker) => worker.reservations, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'worker_id' })
  worker: Worker;

  @Column('int', { name: 'total_duration_minutes' })
  totalDurationMinutes: number;
}

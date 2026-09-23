import { Worker } from 'src/workers/entities/worker.entity';
import { User } from 'src/auth/entities/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReservationServiceOrmEntity } from './reservation-service.orm-entity';

@Entity('reservations')
export class ReservationOrmEntity {
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

  /**
   * ¿La estilista la fijó la clienta o la repartió el sistema? Se guarda como
   * un solo bit y no como un `preferred_worker_id` aparte porque la única
   * pregunta que se le hace es de sí o no —«¿puedo reasignar esta reserva?»— y
   * `worker_id` sigue siendo la única verdad sobre quién atiende: no aparece
   * una segunda fuente que pueda desincronizarse de ella.
   *
   * `DEFAULT false` es deliberado: significa «la repartió el sistema», que es
   * lo que era cierto de todas las reservas anteriores a la asignación
   * automática.
   */
  @Column('boolean', { name: 'worker_pinned', default: false })
  workerPinned: boolean;

  @Column('int', { name: 'total_duration_minutes' })
  totalDurationMinutes: number;

  /** Ciclo de vida (§6.4): pendiente | confirmada | cumplida | cancelada. */
  @Column('text', { default: 'pendiente' })
  status: string;

  @Column('uuid', { name: 'user_id', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column('text', { name: 'customer_name', nullable: true })
  customerName: string | null;

  @Column('text', { name: 'customer_phone', nullable: true })
  customerPhone: string | null;

  /**
   * Teléfono normalizado a E.164 (`57` + móvil de 10 dígitos), derivado de
   * `customer_phone` por el mapper. Es la **única columna consultable**: el
   * crudo se guarda tal como lo escribió la clienta, así que `300 123 4567` y
   * `+573001234567` son la misma persona con dos textos distintos. Nula cuando
   * el número no es un móvil colombiano válido: esas reservas no son
   * contactables por WhatsApp y quedan fuera del canal, igual que ya lo estaban
   * para el aviso saliente.
   */
  @Column('text', { name: 'customer_phone_e164', nullable: true })
  customerPhoneE164: string | null;

  @Column('text', { name: 'customer_email', nullable: true })
  customerEmail: string | null;

  @OneToMany(() => ReservationServiceOrmEntity, (s) => s.reservation, {
    cascade: true,
    eager: true,
  })
  services: ReservationServiceOrmEntity[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Tabla `assistant_pending_bookings` (plan 06, D4): propuestas de reserva del
 * asistente en WhatsApp, a la espera del botón *Confirmar*. Viven 15 minutos;
 * la purga diaria se lleva las vencidas.
 */
@Entity('assistant_pending_bookings')
export class PendingBookingOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'phone_e164' })
  phoneE164: string;

  @Column('text', { name: 'customer_name' })
  customerName: string;

  @Column('uuid', { name: 'service_ids', array: true })
  serviceIds: string[];

  @Column('timestamptz', { name: 'scheduled_at' })
  scheduledAt: Date;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  /** Cuándo se consumió (confirmada o descartada). Null = sigue viva. */
  @Column('timestamptz', { name: 'used_at', nullable: true })
  usedAt: Date | null;

  @Column('text', { nullable: true })
  outcome: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Tabla `assistant_pending_absences` (16.ª migración, 2026-11-11): propuestas
 * de ausencia de la dueña por WhatsApp, a la espera del botón *Confirmar*.
 * Viven 15 minutos; la purga diaria se lleva las vencidas. La clave foránea a
 * `workers` (borrado en cascada) la pone la migración.
 */
@Entity('assistant_pending_absences')
export class PendingAbsenceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', { name: 'phone_e164' })
  phoneE164: string;

  @Column('uuid', { name: 'worker_id' })
  workerId: string;

  @Column('timestamptz', { name: 'starts_at' })
  startsAt: Date;

  @Column('timestamptz', { name: 'ends_at' })
  endsAt: Date;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  /** Cuándo se consumió (confirmada, descartada o reemplazada). Null = viva. */
  @Column('timestamptz', { name: 'used_at', nullable: true })
  usedAt: Date | null;

  @Column('text', { nullable: true })
  outcome: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

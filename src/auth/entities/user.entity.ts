import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReviewByUser } from 'src/reviews/entities/review-by-user.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text', {
    unique: true,
    nullable: false,
  })
  email: string;

  @Column('text', {
    nullable: false,
    select: false,
  })
  password: string;

  @Column('text', { nullable: false })
  fullName: string;

  @Column('text', {
    nullable: false,
    array: true,
    default: ['user'],
  })
  roles: string[];

  @Column('boolean', { default: true })
  isActive: boolean;

  /**
   * Momento en que el usuario aceptó la Política de Tratamiento de Datos
   * Personales (Ley 1581 de 2012, Decreto 1377 de 2013). Es la evidencia
   * auditable del consentimiento. Admite nulos únicamente por las cuentas
   * creadas antes de que se registrara esta marca.
   */
  @Column('timestamptz', { name: 'data_policy_accepted_at', nullable: true })
  dataPolicyAcceptedAt: Date | null;

  /**
   * Momento en que el titular confirmó su correo mediante el enlace de
   * verificación. Nulo mientras no lo haya hecho. Ver Fase 3a.
   */
  @Column('timestamptz', { name: 'email_verified_at', nullable: true })
  emailVerifiedAt: Date | null;

  @OneToMany(() => ReviewByUser, (reviewByUser) => reviewByUser.user)
  reviewsByUser: ReviewByUser[];

  @BeforeInsert()
  emailToLowerCase() {
    this.email = this.email.toLowerCase().trim();
  }
  @BeforeUpdate()
  emailToLowerCaseOnUpdate() {
    this.email = this.email.toLowerCase().trim();
  }
}

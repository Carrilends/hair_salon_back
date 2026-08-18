import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/auth/entities/user.entity';

@Entity('refresh_tokens')
@Index(['userId'])
@Index(['familyId'])
export class RefreshTokenOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Identifica la cadena de rotaciones de UNA sesión (un navegador). */
  @Column('uuid', { name: 'family_id' })
  familyId: string;

  /** Hash del token. El valor en claro solo existe dentro de la cookie. */
  @Column('text', { name: 'token_hash', unique: true })
  tokenHash: string;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  /** Hash del sucesor tras rotar; su presencia distingue reuso de expiración. */
  @Column('text', { name: 'replaced_by_hash', nullable: true })
  replacedByHash: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}

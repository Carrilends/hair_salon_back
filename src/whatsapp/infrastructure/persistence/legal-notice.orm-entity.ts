import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * El último aviso de tratamiento de datos enviado a cada número (decisión de
 * Luis, 2026-11-10). Una fila por número: la clave primaria es el número.
 */
@Entity('whatsapp_legal_notices')
export class LegalNoticeOrmEntity {
  @PrimaryColumn('text', { name: 'phone_e164' })
  phoneE164: string;

  @Column('timestamptz', { name: 'enviado_en' })
  enviadoEn: Date;

  @Column('text', { name: 'version_politica' })
  versionPolitica: string;
}

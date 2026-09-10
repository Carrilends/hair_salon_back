import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Un mensaje entrante ya procesado. La clave primaria es el `wamid` que asigna
 * Meta: es lo que hace que la segunda reentrega choque contra la base y no
 * contra una comprobación en memoria que dos procesos podrían cruzar.
 */
@Entity('whatsapp_inbound_messages')
export class InboundMessageOrmEntity {
  @PrimaryColumn('text', { name: 'wa_message_id' })
  waMessageId: string;

  @Column('text', { name: 'wa_from' })
  waFrom: string;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;
}

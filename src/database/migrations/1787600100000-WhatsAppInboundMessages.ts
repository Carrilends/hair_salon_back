import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 2 de WhatsApp — bitácora de mensajes entrantes.
 *
 * Meta reentrega un webhook con backoff durante días si no recibe un 200 a
 * tiempo. La clave primaria es el `wamid` que asigna Meta, de modo que la
 * segunda reentrega choca contra la base —y no contra una comprobación en
 * memoria que dos instancias podrían cruzar—. El índice sobre `received_at`
 * sostiene la purga programada.
 */
export class WhatsAppInboundMessages1787600100000
  implements MigrationInterface
{
  name = 'WhatsAppInboundMessages1787600100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "whatsapp_inbound_messages" (
        "wa_message_id" text PRIMARY KEY,
        "wa_from" text NOT NULL,
        "received_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_whatsapp_inbound_received_at" ` +
        `ON "whatsapp_inbound_messages" ("received_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_whatsapp_inbound_received_at"`,
    );
    await queryRunner.query(`DROP TABLE "whatsapp_inbound_messages"`);
  }
}

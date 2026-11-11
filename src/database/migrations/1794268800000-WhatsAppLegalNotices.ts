import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El último aviso de tratamiento de datos enviado a cada número de WhatsApp y
 * con qué versión de la política (decisión de Luis, 2026-11-10). Se vuelve a
 * enviar a los 15 días o si la versión cambia.
 *
 * Escrita a mano: `migration:generate` sobre esta base propone además borrar
 * la restricción de exclusión de `reservations`. Solo crea esta tabla.
 */
export class WhatsAppLegalNotices1794268800000 implements MigrationInterface {
  name = 'WhatsAppLegalNotices1794268800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "whatsapp_legal_notices" (` +
        `"phone_e164" text NOT NULL, ` +
        `"enviado_en" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"version_politica" text NOT NULL, ` +
        `CONSTRAINT "PK_whatsapp_legal_notices" PRIMARY KEY ("phone_e164"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "whatsapp_legal_notices"`);
  }
}

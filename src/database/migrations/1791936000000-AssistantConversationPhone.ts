import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 06, F3a — el asistente en WhatsApp. Añade el número del remitente a la
 * conversación: en WhatsApp la identidad es el teléfono que firma Meta, no un
 * usuario, y la conversación se encuentra por número, no por un id que el
 * canal tendría que recordar.
 *
 * Escrita a mano a propósito: `migration:generate` sobre esta base propone
 * además borrar la restricción de exclusión de `reservations` (la red contra la
 * doble reserva). Aquí no hay nada más que esta columna y su índice.
 *
 * Sin relleno: ninguna conversación existente es de WhatsApp.
 */
export class AssistantConversationPhone1791936000000
  implements MigrationInterface
{
  name = 'AssistantConversationPhone1791936000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD COLUMN "phone_e164" text`,
    );

    // Parcial: las conversaciones de la web, que son casi todas, no llevan
    // número. El orden sirve a la única consulta que lo usa: «la más reciente
    // de este número con actividad en las últimas 24 h».
    await queryRunner.query(
      `CREATE INDEX "idx_assistant_conversations_phone_e164" ` +
        `ON "assistant_conversations" ("phone_e164", "updated_at" DESC) ` +
        `WHERE "phone_e164" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_assistant_conversations_phone_e164"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" DROP COLUMN "phone_e164"`,
    );
  }
}

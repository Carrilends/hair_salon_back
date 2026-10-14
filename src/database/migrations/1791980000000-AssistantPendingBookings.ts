import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Plan 06, F4 (D4): propuestas de reserva del asistente en WhatsApp, a la
 * espera de que la clienta pulse *Confirmar*. La reserva de verdad la crea el
 * botón, nunca el modelo.
 *
 * Escrita a mano: `migration:generate` sobre esta base propone además borrar
 * la restricción de exclusión de `reservations`.
 */
export class AssistantPendingBookings1791980000000
  implements MigrationInterface
{
  name = 'AssistantPendingBookings1791980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "assistant_pending_bookings" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"phone_e164" text NOT NULL, ` +
        `"customer_name" text NOT NULL, ` +
        `"service_ids" uuid array NOT NULL, ` +
        `"scheduled_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"used_at" TIMESTAMP WITH TIME ZONE, ` +
        `"outcome" text, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_assistant_pending_bookings" PRIMARY KEY ("id"))`,
    );
    // Para la purga diaria. Las búsquedas son por id (clave primaria).
    await queryRunner.query(
      `CREATE INDEX "idx_assistant_pending_bookings_expires_at" ` +
        `ON "assistant_pending_bookings" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_assistant_pending_bookings_expires_at"`,
    );
    await queryRunner.query(`DROP TABLE "assistant_pending_bookings"`);
  }
}

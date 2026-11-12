import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ausencias de las estilistas (2026-11-11) y las propuestas pendientes del
 * asistente de WhatsApp para registrarlas (`assistant_pending_absences`).
 *
 * Escrita a mano: `migration:generate` sobre esta base propone además borrar la
 * restricción de exclusión de `reservations`. Esta migración no la toca;
 * `btree_gist` ya existe por la de las reservas (se repite con IF NOT EXISTS).
 */
export class WorkerAbsences1794355200000 implements MigrationInterface {
  name = 'WorkerAbsences1794355200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(
      `CREATE TABLE "worker_absences" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"worker_id" uuid NOT NULL, ` +
        `"starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_worker_absences" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_worker_absences_worker" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE, ` +
        `CONSTRAINT "CHK_worker_absences_range" CHECK ("starts_at" < "ends_at"), ` +
        `CONSTRAINT "worker_absences_no_overlap" EXCLUDE USING gist ("worker_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&))`,
    );
    await queryRunner.query(
      `CREATE TABLE "assistant_pending_absences" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"phone_e164" text NOT NULL, ` +
        `"worker_id" uuid NOT NULL, ` +
        `"starts_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"ends_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"used_at" TIMESTAMP WITH TIME ZONE, ` +
        `"outcome" text, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_assistant_pending_absences" PRIMARY KEY ("id"), ` +
        `CONSTRAINT "FK_assistant_pending_absences_worker" FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assistant_pending_absences"`);
    await queryRunner.query(`DROP TABLE "worker_absences"`);
  }
}

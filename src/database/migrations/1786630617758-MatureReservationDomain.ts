import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 2 — Dominio de reservas maduro. Añade a `reservations` el estado del
 * ciclo de vida (§6.4), el vínculo opcional a `users`, los datos de contacto de
 * invitado y las marcas de tiempo; y crea `reservation_services` (líneas de
 * servicio con snapshot de nombre/precio/duración).
 *
 * Nota: se recortaron del diff generado unos cambios espurios sobre la tabla
 * `service` (columnas y constraint de slug). Correspondían a un drift previo de
 * Fase 0 (el esquema del volumen dev no coincide con `InitialSchema`), NO a esta
 * fase; se documentan aparte y no se mezclan aquí.
 */
export class MatureReservationDomain1786630617758
  implements MigrationInterface
{
  name = 'MatureReservationDomain1786630617758';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reservation_services" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reservation_id" uuid NOT NULL, "service_id" uuid, "name" text NOT NULL, "price" numeric NOT NULL, "duration_minutes" integer NOT NULL, CONSTRAINT "PK_4f6633abeabcab5b1c5c4288f19" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD "status" text NOT NULL DEFAULT 'pendiente'`,
    );
    await queryRunner.query(`ALTER TABLE "reservations" ADD "user_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD "customer_name" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD "customer_phone" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD "customer_email" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation_services" ADD CONSTRAINT "FK_98e19f81ba239737fcfa594d6bf" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD CONSTRAINT "FK_4af5055a871c46d011345a255a6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "FK_4af5055a871c46d011345a255a6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation_services" DROP CONSTRAINT "FK_98e19f81ba239737fcfa594d6bf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN "customer_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN "customer_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN "customer_name"`,
    );
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "user_id"`);
    await queryRunner.query(`ALTER TABLE "reservations" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TABLE "reservation_services"`);
  }
}

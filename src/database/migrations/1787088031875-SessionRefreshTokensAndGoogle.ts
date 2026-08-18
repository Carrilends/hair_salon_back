import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 3b — sesión con refresh rotativo e inicio de sesión con Google.
 *
 * Cambios (todos aditivos salvo el relajamiento de `password`):
 *   - Tabla nueva `refresh_tokens` (familia, hash, rotación, FK CASCADE).
 *   - `users.google_id` (único, nullable) para el inicio de sesión con Google.
 *   - `users.password` pasa a admitir nulos (S8): las cuentas creadas con Google
 *     no tienen contraseña local. Es un `DROP NOT NULL`, NO un `DROP/ADD COLUMN`:
 *     los hashes existentes se conservan.
 *
 * Nota sobre el generador: TypeORM propuso además dropear/renombrar el FK y el
 * índice de `auth_tokens` y —peligrosamente— dropear la restricción de exclusión
 * `excl_reservations_worker_overlap` (M5, creada por SQL crudo y por tanto no
 * modelada en las entidades). Esos cambios se eliminaron a mano: esta migración
 * deja intactos los objetos de las Fases 3a/M5.
 */
export class SessionRefreshTokensAndGoogle1787088031875
  implements MigrationInterface
{
  name = 'SessionRefreshTokensAndGoogle1787088031875';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "replaced_by_hash" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE ("token_hash"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d5e27da0cd39bc3bb2811fc8ba" ON "refresh_tokens" ("family_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "google_id" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_0bd5012aeb82628e07f6a1be53b" UNIQUE ("google_id")`,
    );
    // S8: relaja la obligatoriedad de la contraseña sin recrear la columna.
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    // ATENCIÓN: volver a poner NOT NULL falla si ya existe alguna cuenta de
    // Google sin contraseña. La reversión solo es segura antes de que se registre
    // la primera cuenta de Google.
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_0bd5012aeb82628e07f6a1be53b"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "google_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d5e27da0cd39bc3bb2811fc8ba"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 3a — Auth hexagonal. Añade a `users` la marca de verificación de correo
 * (`email_verified_at`) y crea `auth_tokens`: tokens de un solo uso con
 * expiración para el restablecimiento de contraseña y la verificación de correo
 * (el valor en claro nunca se persiste, solo su hash).
 *
 * Migración escrita a mano (no autogenerada) para no arrastrar el drift previo
 * de la tabla `service` del volumen dev (ver Fase 2). El relleno de datos del
 * `up()` —marcar como verificadas las cuentas preexistentes— tampoco lo cubre
 * la generación automática.
 */
export class AuthEmailVerificationAndTokens1786841983000
  implements MigrationInterface
{
  name = 'AuthEmailVerificationAndTokens1786841983000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    // Las cuentas creadas antes de existir la verificación se consideran
    // verificadas: de lo contrario quedarían bloqueadas por avisos que nunca
    // pidieron. La marca de tiempo es la de la migración, no la del registro.
    await queryRunner.query(
      `UPDATE "users" SET "email_verified_at" = now() WHERE "email_verified_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE "auth_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "type" text NOT NULL, "token_hash" text NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_auth_tokens_token_hash" UNIQUE ("token_hash"), CONSTRAINT "PK_auth_tokens_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_auth_tokens_user_id_type" ON "auth_tokens" ("user_id", "type")`,
    );
    await queryRunner.query(
      `ALTER TABLE "auth_tokens" ADD CONSTRAINT "FK_auth_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "auth_tokens" DROP CONSTRAINT "FK_auth_tokens_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_auth_tokens_user_id_type"`);
    await queryRunner.query(`DROP TABLE "auth_tokens"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "email_verified_at"`,
    );
  }
}

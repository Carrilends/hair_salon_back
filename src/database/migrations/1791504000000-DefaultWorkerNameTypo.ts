import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La opción predeterminada se llamaba «Sin prefencia» en la base (errata
 * escrita a mano) y es lo que viajaba a los avisos y al asistente. Se corrige
 * la fila, no el código que la lee.
 *
 * ── Exacta, no heurística ───────────────────────────────────────────────────
 *
 * Solo toca la fila `is_default` cuyo nombre es EXACTAMENTE la errata: si la
 * dueña la hubiera renombrado, no se pisa. `down` hace el cambio inverso con
 * la condición inversa.
 *
 * ── Lo que esta migración NO toca ───────────────────────────────────────────
 *
 * No se generó con la CLI. `migration:generate` en este repo propone además
 * eliminar la restricción de exclusión de `reservations` —la red contra la
 * doble reserva— y renombrar índices y claves foráneas de migraciones
 * anteriores. Nada de eso es este cambio.
 */
export class DefaultWorkerNameTypo1791504000000 implements MigrationInterface {
  name = 'DefaultWorkerNameTypo1791504000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "workers" SET "name" = 'Sin preferencia' WHERE "is_default" = true AND "name" = 'Sin prefencia'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "workers" SET "name" = 'Sin prefencia' WHERE "is_default" = true AND "name" = 'Sin preferencia'`,
    );
  }
}

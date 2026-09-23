import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `reservations.worker_pinned`: distingue la estilista que **eligió la clienta**
 * de la que **repartió el sistema**.
 *
 * Por qué hace falta. `worker_id` dice quién atiende pero no por qué, y la
 * reprogramación necesita ese «por qué»: comprobar el solape contra una sola
 * agenda rechazaba citas con el salón medio vacío cuando esa estilista la había
 * asignado el reparto interno, no la clienta. Con la marca, mover una cita sin
 * preferencia puede reasignarla a otra estilista libre, y la de quien sí eligió
 * queda intacta.
 *
 * ── Sobre el relleno de las filas existentes ─────────────────────────────────
 *
 * Es **exacto, no heurístico**. Nadie elige «Sin preferencia» como estilista: es
 * una opción del formulario del portal cuyo valor es `null`, y el portal
 * entonces **omite** `workerId` en la petición. Por tanto, en los datos previos
 * a esta migración:
 *
 *   - apuntar al trabajador por defecto  ⇔  la asignó el sistema   → false
 *   - apuntar a una estilista nombrada   ⇔  la eligió la clienta   → true
 *
 * Esa equivalencia **caduca**. Desde que existe la asignación automática
 * (commit `11de163`), una reserva creada sin `workerId` ya recibe una estilista
 * real, así que `worker_id <> defecto` deja de implicar «la eligió la clienta».
 * Se comprobó antes de escribir esto que no había ninguna reserva creada después
 * de aquel commit (las 9 existentes son del 2026-08-18 al 2026-09-09), y por eso
 * el relleno es exacto. Si alguna base llegara a esta migración con reservas
 * posteriores, esas filas quedarían marcadas de más: conservador (nunca se
 * reasigna a quien no tocaba) pero ya no exacto.
 *
 * `DEFAULT false` deja bien las filas del estilista por defecto sin tocarlas.
 *
 * La restricción de exclusión `excl_reservations_worker_overlap` **no se toca**:
 * sigue siendo por estilista y sigue siendo la red de seguridad contra la
 * carrera entre el conteo de solapes y el `UPDATE`. Al reasignar cambian
 * `worker_id` y la ventana a la vez, y la restricción cubre el resultado.
 *
 * (La migración se generó con la CLI contra una base fresca y luego se recortó a
 * mano: el generador proponía además renombrar índices y claves foráneas creadas
 * por las migraciones anteriores y **eliminar la restricción de exclusión**.
 * Nada de eso es este cambio.)
 */
export class ReservationWorkerPinned1790193467592
  implements MigrationInterface
{
  name = 'ReservationWorkerPinned1790193467592';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD "worker_pinned" boolean NOT NULL DEFAULT false`,
    );

    // `NOT EXISTS` y no `worker_id <> (SELECT …)`: si no hubiera trabajador por
    // defecto, la comparación con NULL daría NULL y no marcaría nada, que es
    // justo lo contrario de lo correcto (sin trabajador por defecto, toda
    // estilista asignada es una estilista elegida).
    await queryRunner.query(`
      UPDATE "reservations" r
      SET "worker_pinned" = true
      WHERE NOT EXISTS (
        SELECT 1 FROM "workers" w
        WHERE w."id" = r."worker_id" AND w."is_default" = true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN "worker_pinned"`,
    );
  }
}

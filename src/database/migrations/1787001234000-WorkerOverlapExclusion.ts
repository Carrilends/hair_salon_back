import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase de endurecimiento — M5. Garantiza a nivel de base de datos que dos
 * reservas NO canceladas del mismo estilista no se solapen en el tiempo. Es el
 * backstop de la carrera check-then-act de `CreateReservationUseCase`
 * (`countOverlaps` seguido de `save` sin transacción): ante dos peticiones
 * concurrentes al mismo estilista y franja, Postgres rechaza la segunda con
 * `23P01`, que el repositorio traduce a `WorkerOverlapError` (409).
 */
export class WorkerOverlapExclusion1787001234000 implements MigrationInterface {
  name = 'WorkerOverlapExclusion1787001234000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `btree_gist` habilita el operador de igualdad sobre `worker_id` (uuid)
    // dentro del índice GiST que soporta la constraint de exclusión.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD CONSTRAINT "excl_reservations_worker_overlap" ` +
        `EXCLUDE USING gist (worker_id WITH =, tstzrange(scheduled_at, ended_at) WITH &&) ` +
        `WHERE (status <> 'cancelada')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "excl_reservations_worker_overlap"`,
    );
    // La extensión `btree_gist` no se elimina: puede haber otros objetos que la usen.
  }
}

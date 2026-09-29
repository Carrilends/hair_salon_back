import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Auditoría del gasto del asistente: `cached_tokens` en las dos tablas y un
 * índice por fecha sobre los mensajes.
 *
 * ── Por qué `cached_tokens` ─────────────────────────────────────────────────
 *
 * El proveedor informa qué parte de la entrada sirvió desde su caché, que
 * factura más barata. `TokenUsage` ya lo llevaba, pero no había dónde
 * escribirlo: se perdía al guardar. El resultado era que el ahorro del prompt
 * caching —la única palanca de coste que el proyecto tiene sobre el prompt del
 * sistema y las nueve definiciones de herramientas— era invisible justo en la
 * tabla donde se mide el gasto.
 *
 * Es un **desglose de `prompt_tokens`, no un sumando**: `cached_tokens` ya está
 * contado dentro de aquél. Sumarlos al total contaría dos veces la misma
 * entrada.
 *
 * `DEFAULT 0` en la conversación (columna no nula, como sus dos hermanas) y
 * nulable en el mensaje (como sus dos hermanas): en los mensajes, nulo
 * significa «de este mensaje no se sabe», que es el estado real de las filas
 * anteriores a la auditoría por mensaje.
 *
 * ── Por qué el índice ───────────────────────────────────────────────────────
 *
 * El techo diario de gasto suma los tokens del día en cada turno, antes de
 * llamar al proveedor. Sin índice esa suma es un recorrido completo de
 * `assistant_messages` en el camino crítico de cada mensaje; el coste crecería
 * con el historial acumulado, que es justo lo contrario de lo que se quiere de
 * una red de seguridad.
 *
 * El índice existente `(conversation_id, seq)` no sirve para esto: ordena
 * dentro de una conversación, no por fecha entre todas.
 *
 * ── Lo que esta migración NO toca ───────────────────────────────────────────
 *
 * No se generó con la CLI. `migration:generate` en este repo propone además
 * **eliminar la restricción de exclusión** `excl_reservations_worker_overlap`,
 * que es la red contra la doble reserva, y renombrar índices y claves foráneas
 * de migraciones anteriores. Nada de eso es este cambio.
 */
export class AssistantUsageAudit1790900000000 implements MigrationInterface {
  name = 'AssistantUsageAudit1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD "cached_tokens" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD "cached_tokens" integer`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assistant_messages_created_at" ON "assistant_messages" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_assistant_messages_created_at"`);
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP COLUMN "cached_tokens"`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" DROP COLUMN "cached_tokens"`,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 2 de WhatsApp — canal entrante. Añade la columna consultable del
 * teléfono de la clienta.
 *
 * El problema que resuelve: `customer_phone` se guarda **en crudo**, tal como lo
 * escribe la clienta, y el DTO solo exige siete caracteres. La misma persona
 * puede estar como `3001234567`, `+57 300 123 4567` o `(300) 123-4567`. Cuando
 * llega un webhook de Meta con el remitente en E.164 no hay forma de encontrar
 * su reserva. La columna derivada da esa forma canónica y el índice la hace
 * barata de consultar.
 *
 * **Quién la mantiene:** la escribe `ReservationMapper.toOrmScalars`, que corre
 * en cada `INSERT` y en cada `UPDATE`. La fuente de verdad de la regla es
 * `src/common/phone.ts`; el `UPDATE` de relleno de aquí abajo es un **espejo de
 * una sola vez** de esa regla, no su fuente. Cualquier fila que quedara mal
 * rellenada se corrige sola en el siguiente guardado.
 */
export class ReservationPhoneE1641787600000000 implements MigrationInterface {
  name = 'ReservationPhoneE1641787600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN "customer_phone_e164" text`,
    );

    // Relleno de lo ya existente. Espejo de `normalizeCoPhoneToE164`: se quitan
    // los no dígitos y los ceros de troncal, se recorta el indicativo `57`
    // cuando deja 12 dígitos, y solo se acepta un móvil de 10 que empiece por 3.
    await queryRunner.query(`
      UPDATE "reservations"
      SET "customer_phone_e164" = '57' || sub.local
      FROM (
        SELECT
          id,
          CASE
            WHEN length(digits) = 12 AND digits LIKE '57%' THEN substring(digits from 3)
            ELSE digits
          END AS local
        FROM (
          SELECT
            id,
            regexp_replace(regexp_replace(customer_phone, '\\D', '', 'g'), '^0+', '') AS digits
          FROM "reservations"
          WHERE customer_phone IS NOT NULL
        ) limpio
      ) sub
      WHERE "reservations".id = sub.id
        AND sub.local ~ '^3[0-9]{9}$'
    `);

    // Índice parcial: las reservas de usuarias registradas no traen contacto, así
    // que la mayoría de filas serán nulas y no tiene sentido indexarlas.
    await queryRunner.query(
      `CREATE INDEX "idx_reservations_customer_phone_e164" ` +
        `ON "reservations" ("customer_phone_e164") ` +
        `WHERE "customer_phone_e164" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_reservations_customer_phone_e164"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN "customer_phone_e164"`,
    );
  }
}

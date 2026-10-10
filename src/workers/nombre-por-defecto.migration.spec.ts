import { QueryRunner } from 'typeorm';
import { DefaultWorkerNameTypo1791504000000 } from '../database/migrations/1791504000000-DefaultWorkerNameTypo';

/** Un `QueryRunner` que solo apunta el SQL, sin espacios de sobra. */
function corredor() {
  const consultas: string[] = [];
  const queryRunner = {
    query: jest.fn(async (sql: string) => {
      consultas.push(sql.replace(/\s+/g, ' ').trim());
    }),
  } as unknown as QueryRunner;
  return { queryRunner, consultas };
}

describe('DefaultWorkerNameTypo (migración escrita a mano)', () => {
  it('up corrige solo la predeterminada que tiene la errata, en una sentencia', async () => {
    const { queryRunner, consultas } = corredor();

    await new DefaultWorkerNameTypo1791504000000().up(queryRunner);

    expect(consultas).toEqual([
      `UPDATE "workers" SET "name" = 'Sin preferencia' WHERE "is_default" = true AND "name" = 'Sin prefencia'`,
    ]);
  });

  it('down deshace exactamente lo de up', async () => {
    const { queryRunner, consultas } = corredor();

    await new DefaultWorkerNameTypo1791504000000().down(queryRunner);

    expect(consultas).toEqual([
      `UPDATE "workers" SET "name" = 'Sin prefencia' WHERE "is_default" = true AND "name" = 'Sin preferencia'`,
    ]);
  });

  it('se llama como su clase, que es lo que TypeORM apunta en la tabla de migraciones', () => {
    expect(new DefaultWorkerNameTypo1791504000000().name).toBe(
      'DefaultWorkerNameTypo1791504000000',
    );
  });
});

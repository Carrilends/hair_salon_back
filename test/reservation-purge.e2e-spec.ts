import { join } from 'path';
import { DataSource } from 'typeorm';
import { TypeOrmReservationRepository } from 'src/reservations/infrastructure/persistence/typeorm-reservation.repository';
import { ReservationOrmEntity } from 'src/reservations/infrastructure/persistence/reservation.orm-entity';
import { PurgeOldReservationsUseCase } from 'src/reservations/application/purge-old-reservations.use-case';

/**
 * RF26: la limpieza mensual borra la reserva que terminó hace más de un mes y
 * conserva la reciente, contra Postgres real. Escribe en la base, así que se
 * niega a correr fuera de `HairSalonE2E`.
 * Ejecución: DB_NAME=HairSalonE2E DB_PORT=3334 npm run test:e2e -- reservation-purge
 */
describe('PurgeOldReservationsUseCase (integración, HairSalonE2E)', () => {
  let dataSource: DataSource;
  const ids: string[] = [];
  const ahora = new Date('2026-10-27T15:00:00.000Z');
  const haceDias = (d: number) => new Date(ahora.getTime() - d * 86_400_000);

  beforeAll(async () => {
    if (process.env.DB_NAME !== 'HairSalonE2E') {
      throw new Error(
        'Esta prueba escribe en PostgreSQL y solo corre con DB_NAME=HairSalonE2E',
      );
    }
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3334),
      username: process.env.DB_USER ?? 'luis',
      password: process.env.DB_PASSWORD ?? '123456',
      database: process.env.DB_NAME,
      entities: [
        join(__dirname, '../src/**/*.entity.ts'),
        join(__dirname, '../src/**/*.orm-entity.ts'),
      ],
      synchronize: false,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (ids.length) {
        await dataSource.query('DELETE FROM reservations WHERE id = ANY($1)', [
          ids,
        ]);
      }
      await dataSource.destroy();
    }
  });

  it('la limpieza borra la que terminó hace 35 días y conserva la de 20', async () => {
    const [worker] = await dataSource.query('SELECT id FROM workers LIMIT 1');
    expect(worker).toBeDefined();

    const insertar = async (diasAtras: number) => {
      const fin = haceDias(diasAtras);
      const inicio = new Date(fin.getTime() - 60 * 60_000);
      const [fila] = await dataSource.query(
        `INSERT INTO reservations
           (scheduled_at, ended_at, worker_id, total_duration_minutes, status)
         VALUES ($1, $2, $3, 60, 'cumplida') RETURNING id`,
        [inicio, fin, worker.id],
      );
      ids.push(fila.id);
      return fila.id as string;
    };
    const vieja = await insertar(35);
    const reciente = await insertar(20);

    const useCase = new PurgeOldReservationsUseCase(
      new TypeOrmReservationRepository(
        dataSource.getRepository(ReservationOrmEntity),
      ),
      { now: () => ahora } as never,
    );
    await useCase.execute();

    const quedan = await dataSource.query(
      'SELECT id FROM reservations WHERE id = ANY($1)',
      [[vieja, reciente]],
    );
    expect(quedan.map((r: { id: string }) => r.id)).toEqual([reciente]);
  });
});

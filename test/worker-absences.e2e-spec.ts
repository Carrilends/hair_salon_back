import { join } from 'path';
import { DataSource } from 'typeorm';
import { WorkerAbsenceOrmEntity } from 'src/reservations/infrastructure/persistence/worker-absence.orm-entity';
import { TypeOrmWorkerAbsenceRepository } from 'src/reservations/infrastructure/persistence/typeorm-worker-absence.repository';
import { WorkerAbsence } from 'src/reservations/domain/worker-absence';
import { AbsenceOverlapError } from 'src/reservations/domain/errors';

/**
 * Ausencias de estilistas contra Postgres real: restricción de exclusión,
 * borrado en cascada y conversión a hora del salón. Escribe en la base, así
 * que se niega a correr fuera de `HairSalonE2E`.
 * Ejecución: DB_NAME=HairSalonE2E yarn test:e2e -- worker-absences
 */
describe('TypeOrmWorkerAbsenceRepository (integración, HairSalonE2E)', () => {
  let ds: DataSource;
  let sut: TypeOrmWorkerAbsenceRepository;
  const TZ = 'America/Bogota';
  const NOW = new Date('2026-11-11T15:00:00Z');
  const creadas: string[] = [];
  let workerA: string;
  let workerB: string;
  let workerTemp: string;

  const ausencia = (workerId: string, from?: string, to?: string) =>
    WorkerAbsence.create({
      workerId,
      dateYmd: '2030-03-12', // martes
      from,
      to,
      now: NOW,
      tz: TZ,
    });

  async function crearEstilista(nombre: string): Promise<string> {
    const [row] = await ds.query(
      `INSERT INTO workers (name) VALUES ($1) RETURNING id`,
      [nombre],
    );
    return row.id;
  }

  beforeAll(async () => {
    if (process.env.DB_NAME !== 'HairSalonE2E') {
      throw new Error(
        'Esta prueba escribe en PostgreSQL y solo corre con DB_NAME=HairSalonE2E',
      );
    }
    ds = new DataSource({
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
      migrations: [join(__dirname, '../src/database/migrations/*.ts')],
      synchronize: false,
    });
    await ds.initialize();
    sut = new TypeOrmWorkerAbsenceRepository(
      ds.getRepository(WorkerAbsenceOrmEntity),
    );
    workerA = await crearEstilista('Estilista A (prueba ausencias)');
    workerB = await crearEstilista('Estilista B (prueba ausencias)');
    workerTemp = await crearEstilista('Estilista C (prueba ausencias)');
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      await ds.query(`DELETE FROM workers WHERE id = ANY($1)`, [
        [workerA, workerB, workerTemp],
      ]);
      await ds.destroy();
    }
  });

  it('save + overlapsAny', async () => {
    const s = await sut.save(ausencia(workerA, '08:00', '12:00'));
    creadas.push(s.id as string);
    expect(s.id).toBeTruthy();
    const at = (h: string) => new Date(`2030-03-12T${h}:00Z`);
    expect(await sut.overlapsAny(workerA, at('16:30'), at('17:30'))).toBe(true);
    expect(await sut.overlapsAny(workerA, at('17:00'), at('17:30'))).toBe(
      false,
    );
    expect(await sut.overlapsAny(workerB, at('16:30'), at('17:30'))).toBe(
      false,
    );
    expect((await sut.findById(s.id as string))?.workerId).toBe(workerA);
    expect((await sut.listUpcoming(NOW)).some((a) => a.id === s.id)).toBe(true);
  });

  it('dos ausencias que se cruzan de la misma estilista -> AbsenceOverlapError', async () => {
    await expect(
      sut.save(ausencia(workerA, '11:00', '13:00')),
    ).rejects.toBeInstanceOf(AbsenceOverlapError);
  });

  it('de estilistas distintas, sin conflicto', async () => {
    const s = await sut.save(ausencia(workerB, '08:00', '12:00'));
    creadas.push(s.id as string);
    expect(s.id).toBeTruthy();
  });

  it('blocksForDate y minutesByWorkerAndDate devuelven minutos en hora del salón', async () => {
    const bloques = (await sut.blocksForDate('2030-03-12', TZ)).filter(
      (b) => b.workerId === workerA,
    );
    expect(bloques).toEqual([
      { workerId: workerA, startMin: 480, endMin: 720 },
    ]);
    expect(await sut.blocksForDate('2030-03-13', TZ)).toEqual([]);
    const mins = (
      await sut.minutesByWorkerAndDate('2030-03-12', '2030-03-12', TZ)
    ).filter((m) => m.workerId === workerA);
    expect(mins).toEqual([
      { workerId: workerA, dateYmd: '2030-03-12', minutes: 240 },
    ]);
  });

  it('delete borra la ausencia', async () => {
    const id = creadas[1];
    expect(await sut.delete(id)).toBe(true);
    expect(await sut.delete(id)).toBe(false);
    expect(await sut.findById(id)).toBeNull();
  });

  it('borrar la estilista borra sus ausencias', async () => {
    await sut.save(ausencia(workerTemp, '14:00', '16:00'));
    await ds.query(`DELETE FROM workers WHERE id = $1`, [workerTemp]);
    const [{ n }] = await ds.query(
      `SELECT count(*)::int AS n FROM worker_absences WHERE worker_id = $1`,
      [workerTemp],
    );
    expect(n).toBe(0);
  });

  it('la migración no altera excl_reservations_worker_overlap', async () => {
    const leer = () =>
      ds.query(
        `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'excl_reservations_worker_overlap'`,
      );
    const antes = await leer();
    expect(antes).toHaveLength(1);
    // Deshace y vuelve a aplicar la 16.ª migración (solo borra y crea sus tablas).
    await ds.undoLastMigration();
    await ds.runMigrations();
    expect(await leer()).toEqual(antes);
  });
});

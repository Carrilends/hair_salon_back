import { join } from 'path';
import { DataSource } from 'typeorm';
import { PendingAbsenceOrmEntity } from 'src/assistant/infrastructure/pending/pending-absence.orm-entity';
import { TypeOrmPendingAbsenceRepository } from 'src/assistant/infrastructure/pending/typeorm-pending-absence.repository';

/**
 * Propuestas de ausencia del asistente de WhatsApp contra Postgres real: la
 * tabla de la 16.ª migración, el consumo atómico (dos toques a la vez, uno
 * gana), el motivo de cada rechazo y la propuesta nueva que anula la anterior.
 * Escribe en la base, así que se niega a correr fuera de `HairSalonE2E`.
 * Ejecución: DB_NAME=HairSalonE2E yarn test:e2e -- pending-absences
 */
describe('TypeOrmPendingAbsenceRepository (integración, HairSalonE2E)', () => {
  let ds: DataSource;
  let sut: TypeOrmPendingAbsenceRepository;
  let workerId: string;
  // Números que no son de nadie: prefijo de pruebas y sufijo fijo.
  const DUENA = '570000000911';
  const OTRO = '570000000912';
  const AHORA = new Date('2030-03-12T12:00:00Z');
  const VENCE = new Date('2030-03-12T12:15:00Z');

  const nueva = (phoneE164 = DUENA) =>
    sut.save({
      phoneE164,
      workerId,
      startsAt: new Date('2030-03-12T13:00:00Z'),
      endsAt: new Date('2030-03-12T17:00:00Z'),
      expiresAt: VENCE,
    });

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
      synchronize: false,
    });
    await ds.initialize();
    sut = new TypeOrmPendingAbsenceRepository(
      ds.getRepository(PendingAbsenceOrmEntity),
    );
    const [row] = await ds.query(
      `INSERT INTO workers (name) VALUES ($1) RETURNING id`,
      ['Estilista A (prueba propuestas de ausencia)'],
    );
    workerId = row.id;
  });

  afterAll(async () => {
    if (ds?.isInitialized) {
      // El borrado en cascada se lleva sus propuestas.
      await ds.query(`DELETE FROM workers WHERE id = $1`, [workerId]);
      await ds.destroy();
    }
  });

  it('guarda y devuelve la propuesta con sus instantes', async () => {
    const p = await nueva();

    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p).toMatchObject({
      phoneE164: DUENA,
      workerId,
      startsAt: new Date('2030-03-12T13:00:00Z'),
      endsAt: new Date('2030-03-12T17:00:00Z'),
      expiresAt: VENCE,
    });
  });

  it('dos toques a la vez: uno aplica y el otro recibe «usada»', async () => {
    const p = await nueva();

    const [a, b] = await Promise.all([
      sut.consume(p.id, DUENA, AHORA, 'confirmada'),
      sut.consume(p.id, DUENA, AHORA, 'confirmada'),
    ]);

    const ok = [a, b].filter((r) => r.ok);
    expect(ok).toHaveLength(1);
    expect(ok[0]).toMatchObject({
      ok: true,
      absence: { id: p.id, workerId, phoneE164: DUENA },
    });
    expect([a, b].find((r) => !r.ok)).toEqual({ ok: false, motivo: 'usada' });
  });

  it('de otro número, vencida o inexistente: no se consume y dice por qué', async () => {
    const p = await nueva();

    expect(await sut.consume(p.id, OTRO, AHORA, 'confirmada')).toEqual({
      ok: false,
      motivo: 'otro_numero',
    });
    expect(
      await sut.consume(
        p.id,
        DUENA,
        new Date('2030-03-12T12:16:00Z'),
        'confirmada',
      ),
    ).toEqual({ ok: false, motivo: 'vencida' });
    expect(
      await sut.consume(
        '00000000-0000-4000-8000-000000000000',
        DUENA,
        AHORA,
        'confirmada',
      ),
    ).toEqual({ ok: false, motivo: 'no_encontrada' });
    // Sigue viva para su dueña dentro de plazo.
    expect((await sut.consume(p.id, DUENA, AHORA, 'descartada')).ok).toBe(true);
  });

  it('una propuesta nueva anula las anteriores del MISMO número, no las de otro', async () => {
    const vieja = await nueva();
    const deOtro = await nueva(OTRO);

    await sut.supersedeActiveFor(DUENA, AHORA);

    expect(await sut.consume(vieja.id, DUENA, AHORA, 'confirmada')).toEqual({
      ok: false,
      motivo: 'usada',
    });
    expect((await sut.consume(deOtro.id, OTRO, AHORA, 'confirmada')).ok).toBe(
      true,
    );
    const [{ outcome }] = await ds.query(
      `SELECT outcome FROM assistant_pending_absences WHERE id = $1`,
      [vieja.id],
    );
    expect(outcome).toBe('reemplazada');
  });

  it('la purga borra solo las vencidas antes del corte', async () => {
    const p = await nueva();

    const borradas = await sut.purgeExpiredBefore(
      new Date('2030-03-12T12:20:00Z'),
    );

    expect(borradas).toBeGreaterThanOrEqual(1);
    const filas = await ds.query(
      `SELECT id FROM assistant_pending_absences WHERE id = $1`,
      [p.id],
    );
    expect(filas).toHaveLength(0);
  });
});

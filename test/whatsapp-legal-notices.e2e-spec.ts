import { join } from 'path';
import { DataSource } from 'typeorm';
import { TypeOrmLegalNoticeLog } from 'src/whatsapp/infrastructure/persistence/typeorm-legal-notice-log.repository';
import { LegalNoticeOrmEntity } from 'src/whatsapp/infrastructure/persistence/legal-notice.orm-entity';

/**
 * Registro del aviso de tratamiento de datos por número (decisión de Luis,
 * 2026-11-10), contra Postgres real: la tabla de la migración, una fila por
 * número y la segunda anotación la reemplaza. Escribe en la base, así que se
 * niega a correr fuera de `HairSalonE2E`.
 * Ejecución: DB_NAME=HairSalonE2E npm run test:e2e -- whatsapp-legal-notices
 */
describe('TypeOrmLegalNoticeLog (integración, HairSalonE2E)', () => {
  let dataSource: DataSource;
  // Un número que no es de nadie: prefijo de pruebas y sufijo fijo.
  const NUMERO = '570000000901';

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
    await dataSource.query(
      'DELETE FROM whatsapp_legal_notices WHERE phone_e164 = $1',
      [NUMERO],
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.query(
        'DELETE FROM whatsapp_legal_notices WHERE phone_e164 = $1',
        [NUMERO],
      );
      await dataSource.destroy();
    }
  });

  it('sin registro devuelve null; anotar crea la fila y anotar otra vez la reemplaza', async () => {
    const sut = new TypeOrmLegalNoticeLog(
      dataSource.getRepository(LegalNoticeOrmEntity),
    );

    expect(await sut.lastSent(NUMERO)).toBeNull();

    const primero = new Date('2026-10-01T15:00:00.000Z');
    await sut.recordSent({
      phoneE164: NUMERO,
      sentAt: primero,
      policyVersion: '1.4',
    });
    expect(await sut.lastSent(NUMERO)).toEqual({
      sentAt: primero,
      policyVersion: '1.4',
    });

    const segundo = new Date('2026-11-10T15:00:00.000Z');
    await sut.recordSent({
      phoneE164: NUMERO,
      sentAt: segundo,
      policyVersion: '1.5',
    });
    expect(await sut.lastSent(NUMERO)).toEqual({
      sentAt: segundo,
      policyVersion: '1.5',
    });
    const [{ n }] = await dataSource.query(
      'SELECT count(*)::int AS n FROM whatsapp_legal_notices WHERE phone_e164 = $1',
      [NUMERO],
    );
    expect(n).toBe(1);
  });
});

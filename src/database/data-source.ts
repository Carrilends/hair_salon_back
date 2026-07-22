import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * `DataSource` usado exclusivamente por la CLI de TypeORM (generar, aplicar y
 * revertir migraciones). La aplicación en runtime NO pasa por aquí: configura
 * su conexión en `src/app.module.ts` vía `TypeOrmModule.forRootAsync`.
 *
 * Ambos deben leer las mismas variables de entorno. La diferencia es que la CLI
 * corre fuera de Nest, así que necesita cargar el `.env` por su cuenta
 * (`dotenv/config`) y localizar entidades y migraciones por *glob* sobre los
 * fuentes `.ts`, en lugar de `autoLoadEntities`.
 */
function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: parseBool(process.env.DB_SSL) ? { rejectUnauthorized: false } : false,
  // Todas las entidades del proyecto terminan en `.entity.ts`; el glob las cubre
  // sin necesidad de registrarlas una a una.
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  // El esquema se gobierna por migraciones: nunca sincronizar desde la CLI.
  synchronize: false,
  logging: parseBool(process.env.TYPEORM_LOGGING),
});

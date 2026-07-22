import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceModule } from './service/service.module';
import { TypeModule } from './type/type.module';
import { DetailModule } from './detail/detail.module';
import { PlannesModule } from './plannes/plannes.module';
import { CommonModule } from './common/common.module';
import { ImagesModule } from './images/images.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import { TagsModule } from './tags/tags.module';
import { SharedInfoModule } from './shared/shared-info.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { HealthController } from './health.controller';
import { ReviewsModule } from './reviews/reviews.module';
import { WorkersModule } from './workers/workers.module';
import { ReservationsModule } from './reservations/reservations.module';
import { FaqsModule } from './faqs/faqs.module';

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const v = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return undefined;
}

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
        const isProd = nodeEnv === 'production';

        // El esquema lo gobiernan las migraciones de `src/database/migrations`
        // (ver DEPLOYMENT.md). `synchronize` queda desactivado por defecto en
        // todos los entornos; para activarlo puntualmente en desarrollo hay que
        // pedirlo de forma explícita con TYPEORM_SYNCHRONIZE=true.
        const synchronize =
          parseBool(config.get<string>('TYPEORM_SYNCHRONIZE')) ?? false;
        const logging =
          parseBool(config.get<string>('TYPEORM_LOGGING')) ?? !isProd;
        const migrationsRun =
          parseBool(config.get<string>('TYPEORM_MIGRATIONS_RUN')) ?? isProd;

        const dbSsl = parseBool(config.get<string>('DB_SSL')) ?? false;

        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST'),
          port: Number(config.get<string>('DB_PORT')),
          database: config.get<string>('DB_NAME'),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASSWORD'),
          autoLoadEntities: true,
          synchronize,
          // En runtime se ejecuta el build de `dist/`, no los fuentes.
          migrations: ['dist/database/migrations/*.js'],
          migrationsRun,
          logging,
          ssl: dbSsl ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    ServiceModule,
    TypeModule,
    DetailModule,
    PlannesModule,
    CommonModule,
    ImagesModule,
    FilesModule,
    AuthModule,
    TagsModule,
    SharedInfoModule,
    CloudinaryModule,
    ReviewsModule,
    WorkersModule,
    ReservationsModule,
    FaqsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

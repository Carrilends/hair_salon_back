import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceModule } from './service/service.module';
import { TypeModule } from './type/type.module';
import { DetailModule } from './detail/detail.module';
import { PlannesModule } from './plannes/plannes.module';
import { CommonModule } from './common/common.module';
import { ImagesModule } from './images/images.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT, // + signo de mas para convertir de number a string
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      autoLoadEntities: true,
      synchronize: true,
    }),
    ServiceModule,
    TypeModule,
    DetailModule,
    PlannesModule,
    CommonModule,
    ImagesModule,
  ],
})
export class AppModule {}

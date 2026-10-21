import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Detail } from './entities/detail.entity';

// Solo registra la entidad: el detalle se crea y se edita con su servicio; el
// controlador propio respondía texto fijo y se quitó.
@Module({
  imports: [TypeOrmModule.forFeature([Detail])],
})
export class DetailModule {}

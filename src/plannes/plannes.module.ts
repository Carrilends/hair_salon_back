import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Planne } from './entities/planne.entity';

// Solo registra la entidad (fuera del alcance del proyecto): su controlador
// respondía texto fijo y se quitó.
@Module({
  imports: [TypeOrmModule.forFeature([Planne])],
})
export class PlannesModule {}

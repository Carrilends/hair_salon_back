import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Type } from './entities/type.entity';

// Solo registra la entidad: su controlador respondía texto fijo y se quitó.
@Module({
  imports: [TypeOrmModule.forFeature([Type])],
})
export class TypeModule {}

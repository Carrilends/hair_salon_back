import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from './entities/worker.entity';
import { WorkersService } from './workers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Worker])],
  providers: [WorkersService],
  exports: [TypeOrmModule, WorkersService],
})
export class WorkersModule {}

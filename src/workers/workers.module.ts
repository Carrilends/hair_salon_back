import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Worker } from './entities/worker.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { WorkersService } from './workers.service';
import { WorkersController } from './workers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Worker, Reservation])],
  controllers: [WorkersController],
  providers: [WorkersService],
  exports: [TypeOrmModule, WorkersService],
})
export class WorkersModule {}

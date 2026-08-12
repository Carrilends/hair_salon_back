import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkersModule } from 'src/workers/workers.module';
import { AuthModule } from 'src/auth/auth.module';
// Puente temporal (Fase 1 T4): entidad renombrada. El módulo se reescribe en T5.
import { ReservationOrmEntity as Reservation } from './infrastructure/persistence/reservation.orm-entity';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation]), WorkersModule, AuthModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkersModule } from 'src/workers/workers.module';
import { AuthModule } from 'src/auth/auth.module';
import { ReservationOrmEntity } from './infrastructure/persistence/reservation.orm-entity';
import { ReservationsController } from './infrastructure/http/reservations.controller';
import { TypeOrmReservationRepository } from './infrastructure/persistence/typeorm-reservation.repository';
import { WorkersAvailabilityAdapter } from './infrastructure/workers/workers-availability.adapter';
import { SystemClock } from './infrastructure/time/system-clock.adapter';
import { ReservationPurgeScheduler } from './infrastructure/scheduling/reservation-purge.scheduler';
import { CreateReservationUseCase } from './application/create-reservation.use-case';
import { GetOccupancyUseCase } from './application/get-occupancy.use-case';
import { ListActiveReservationsUseCase } from './application/list-active-reservations.use-case';
import { CancelReservationUseCase } from './application/cancel-reservation.use-case';
import { PurgeOldReservationsUseCase } from './application/purge-old-reservations.use-case';
import {
  RESERVATION_REPOSITORY,
  WORKER_AVAILABILITY,
  CLOCK,
} from './application/tokens';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReservationOrmEntity]),
    WorkersModule,
    AuthModule,
  ],
  controllers: [ReservationsController],
  providers: [
    CreateReservationUseCase,
    GetOccupancyUseCase,
    ListActiveReservationsUseCase,
    CancelReservationUseCase,
    PurgeOldReservationsUseCase,
    ReservationPurgeScheduler,
    { provide: RESERVATION_REPOSITORY, useClass: TypeOrmReservationRepository },
    { provide: WORKER_AVAILABILITY, useClass: WorkersAvailabilityAdapter },
    { provide: CLOCK, useClass: SystemClock },
  ],
})
export class ReservationsModule {}

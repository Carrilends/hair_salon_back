import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkersModule } from 'src/workers/workers.module';
import { AuthModule } from 'src/auth/auth.module';
import { Service } from 'src/service/entities/service.entity';
import { ReservationOrmEntity } from './infrastructure/persistence/reservation.orm-entity';
import { ReservationServiceOrmEntity } from './infrastructure/persistence/reservation-service.orm-entity';
import { ReservationsController } from './infrastructure/http/reservations.controller';
import { TypeOrmReservationRepository } from './infrastructure/persistence/typeorm-reservation.repository';
import { WorkersAvailabilityAdapter } from './infrastructure/workers/workers-availability.adapter';
import { SystemClock } from './infrastructure/time/system-clock.adapter';
import { ServiceCatalogAdapter } from './infrastructure/service-catalog/service-catalog.adapter';
import { ReservationPurgeScheduler } from './infrastructure/scheduling/reservation-purge.scheduler';
import { CreateReservationUseCase } from './application/create-reservation.use-case';
import { GetOccupancyUseCase } from './application/get-occupancy.use-case';
import { ListActiveReservationsUseCase } from './application/list-active-reservations.use-case';
import { GetMyReservationsUseCase } from './application/get-my-reservations.use-case';
import { ConfirmReservationUseCase } from './application/confirm-reservation.use-case';
import { CancelReservationUseCase } from './application/cancel-reservation.use-case';
import { PurgeOldReservationsUseCase } from './application/purge-old-reservations.use-case';
import { SettlePastReservationsUseCase } from './application/settle-past-reservations.use-case';
import {
  RESERVATION_REPOSITORY,
  WORKER_AVAILABILITY,
  CLOCK,
  SERVICE_CATALOG,
} from './application/tokens';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReservationOrmEntity,
      ReservationServiceOrmEntity,
      Service,
    ]),
    WorkersModule,
    AuthModule,
  ],
  controllers: [ReservationsController],
  providers: [
    CreateReservationUseCase,
    GetOccupancyUseCase,
    ListActiveReservationsUseCase,
    GetMyReservationsUseCase,
    ConfirmReservationUseCase,
    CancelReservationUseCase,
    PurgeOldReservationsUseCase,
    SettlePastReservationsUseCase,
    ReservationPurgeScheduler,
    { provide: RESERVATION_REPOSITORY, useClass: TypeOrmReservationRepository },
    { provide: WORKER_AVAILABILITY, useClass: WorkersAvailabilityAdapter },
    { provide: CLOCK, useClass: SystemClock },
    { provide: SERVICE_CATALOG, useClass: ServiceCatalogAdapter },
  ],
})
export class ReservationsModule {}

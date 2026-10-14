import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkersModule } from 'src/workers/workers.module';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { Service } from 'src/service/entities/service.entity';
import { ReservationOrmEntity } from './infrastructure/persistence/reservation.orm-entity';
import { ReservationServiceOrmEntity } from './infrastructure/persistence/reservation-service.orm-entity';
import { ReservationsController } from './infrastructure/http/reservations.controller';
import { TypeOrmReservationRepository } from './infrastructure/persistence/typeorm-reservation.repository';
import { WorkersAvailabilityAdapter } from './infrastructure/workers/workers-availability.adapter';
import { SystemClock } from './infrastructure/time/system-clock.adapter';
import { ServiceCatalogAdapter } from './infrastructure/service-catalog/service-catalog.adapter';
import { ReservationNotifierAdapter } from './infrastructure/notifications/reservation-notifier.adapter';
import { ReservationPurgeScheduler } from './infrastructure/scheduling/reservation-purge.scheduler';
import { CreateReservationUseCase } from './application/create-reservation.use-case';
import { WorkerAssigner } from './application/worker-assigner';
import { GetOccupancyUseCase } from './application/get-occupancy.use-case';
import { ListActiveReservationsUseCase } from './application/list-active-reservations.use-case';
import { GetMyReservationsUseCase } from './application/get-my-reservations.use-case';
import { ConfirmReservationUseCase } from './application/confirm-reservation.use-case';
import { CancelReservationUseCase } from './application/cancel-reservation.use-case';
import { FindActionableReservationsUseCase } from './application/find-actionable-reservations.use-case';
import { GetReservationUseCase } from './application/get-reservation.use-case';
import { RescheduleReservationUseCase } from './application/reschedule-reservation.use-case';
import { PurgeOldReservationsUseCase } from './application/purge-old-reservations.use-case';
import { SettlePastReservationsUseCase } from './application/settle-past-reservations.use-case';
import {
  RESERVATION_REPOSITORY,
  WORKER_AVAILABILITY,
  CLOCK,
  SERVICE_CATALOG,
  RESERVATION_NOTIFIER,
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
    NotificationsModule,
  ],
  controllers: [ReservationsController],
  providers: [
    // Reparto de estilista compartido por la creación y la reprogramación: si
    // cada una llevara el suyo, acabarían divergiendo.
    WorkerAssigner,
    CreateReservationUseCase,
    GetOccupancyUseCase,
    ListActiveReservationsUseCase,
    GetMyReservationsUseCase,
    ConfirmReservationUseCase,
    CancelReservationUseCase,
    RescheduleReservationUseCase,
    FindActionableReservationsUseCase,
    GetReservationUseCase,
    PurgeOldReservationsUseCase,
    SettlePastReservationsUseCase,
    ReservationPurgeScheduler,
    { provide: RESERVATION_REPOSITORY, useClass: TypeOrmReservationRepository },
    { provide: WORKER_AVAILABILITY, useClass: WorkersAvailabilityAdapter },
    { provide: CLOCK, useClass: SystemClock },
    { provide: SERVICE_CATALOG, useClass: ServiceCatalogAdapter },
    { provide: RESERVATION_NOTIFIER, useClass: ReservationNotifierAdapter },
  ],
  // Exportados para que el asistente y el canal de WhatsApp reutilicen los casos
  // de uso REALES (A6): creación (Fase 5), consulta/cancelación de reservas
  // propias (Fase 6) y, con la Etapa 2, reprogramación, confirmación y las dos
  // consultas que el canal necesita. Ningún consumidor externo ve la
  // persistencia: hablan con casos de uso, nunca con el repositorio.
  exports: [
    CreateReservationUseCase,
    GetMyReservationsUseCase,
    CancelReservationUseCase,
    RescheduleReservationUseCase,
    ConfirmReservationUseCase,
    FindActionableReservationsUseCase,
    GetReservationUseCase,
    // Plan 06, F3b: la agenda que la dueña consulta por WhatsApp (`verAgenda`).
    ListActiveReservationsUseCase,
  ],
})
export class ReservationsModule {}

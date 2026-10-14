import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReservationsModule } from 'src/reservations/reservations.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { WorkersModule } from 'src/workers/workers.module';
import { AssistantModule } from 'src/assistant/assistant.module';

import {
  CLOCK,
  INBOUND_MESSAGE_LOG,
  RATE_LIMITER,
  RESERVATION_ACTIONS,
  WHATSAPP_CHANNEL_CONFIG,
  PENDING_BOOKING_ACTIONS,
} from './application/tokens';
import { PendingBookingActionsAdapter } from './infrastructure/assistant/pending-booking-actions.adapter';
import {
  HandleInboundMessageUseCase,
  WhatsAppChannelConfig,
} from './application/handle-inbound-message.use-case';
import { InboundRateLimiter } from './application/rate-limiter';
import { WhatsAppWebhookController } from './infrastructure/http/whatsapp-webhook.controller';
import { MetaSignatureGuard } from './infrastructure/http/meta-signature.guard';
import { InboundMessageOrmEntity } from './infrastructure/persistence/inbound-message.orm-entity';
import { TypeOrmInboundMessageLog } from './infrastructure/persistence/typeorm-inbound-message-log.repository';
import { ReservationActionsAdapter } from './infrastructure/reservations/reservation-actions.adapter';
import { InboundLogPurgeScheduler } from './infrastructure/scheduling/inbound-log-purge.scheduler';

/** Cuánto trabajo se atiende por remitente y en qué ventana. */
const MAX_MENSAJES = 20;
const VENTANA_MS = 60_000;

/**
 * Canal **entrante** de WhatsApp (Etapa 2).
 *
 * Es un contexto propio y no una carpeta más de `notifications` porque aquél es
 * salida —compone avisos y los entrega— mientras que este recibe, decide y
 * actúa. Lo único que comparten es el transporte, que `NotificationsModule`
 * exporta como `WHATSAPP_SENDER`.
 *
 * Dependencias, todas hacia fuera: casos de uso de Reservas, el transporte de
 * Notificaciones y la disponibilidad de Trabajadores. **Nadie lo importa** salvo
 * `AppModule`, así que no hay forma de que aparezca un ciclo.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([InboundMessageOrmEntity]),
    ReservationsModule,
    NotificationsModule,
    WorkersModule,
    // Plan 06, F4: el botón «Confirmar» de las propuestas del asistente.
    AssistantModule,
  ],
  controllers: [WhatsAppWebhookController],
  providers: [
    MetaSignatureGuard,
    HandleInboundMessageUseCase,
    InboundLogPurgeScheduler,
    // `useExisting` y no `useClass`: con `useClass` habría DOS instancias del
    // adaptador, la del token y la de la clase.
    ReservationActionsAdapter,
    { provide: RESERVATION_ACTIONS, useExisting: ReservationActionsAdapter },
    {
      provide: PENDING_BOOKING_ACTIONS,
      useClass: PendingBookingActionsAdapter,
    },
    { provide: INBOUND_MESSAGE_LOG, useClass: TypeOrmInboundMessageLog },
    {
      // Quién es la peluquería para este canal. Un mensaje que venga de ese
      // número actúa como administración; cualquier otro, como el teléfono que
      // sea. Sin él configurado, nadie es administración: es el estado seguro.
      provide: WHATSAPP_CHANNEL_CONFIG,
      useFactory: (): WhatsAppChannelConfig => ({
        ownerPhone: process.env.SALON_OWNER_WHATSAPP ?? '',
        timeZone: process.env.SALON_TZ ?? 'America/Bogota',
      }),
    },
    {
      provide: RATE_LIMITER,
      useFactory: () => new InboundRateLimiter(MAX_MENSAJES, VENTANA_MS),
    },
    {
      // Reloj propio del canal, para poder fijar la hora en las pruebas sin
      // depender de la hora real de la máquina.
      provide: CLOCK,
      useValue: { now: () => new Date() },
    },
  ],
})
export class WhatsAppModule {}

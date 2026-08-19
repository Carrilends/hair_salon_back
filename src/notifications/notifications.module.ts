import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from 'src/auth/entities/user.entity';
import {
  EMAIL_SENDER,
  NOTIFIERS,
  OWNER_NOTIFICATION_CONFIG,
} from './application/tokens';
import { NotificationDispatcher } from './application/notification-dispatcher';
import { ConsoleEmailSenderAdapter } from './infrastructure/email/console-email-sender.adapter';
import { ProviderEmailSenderAdapter } from './infrastructure/email/provider-email-sender.adapter';
import {
  OwnerEmailNotifier,
  OwnerNotificationConfig,
} from './infrastructure/email/owner-email-notifier.adapter';
import { AdminEventsGateway } from './infrastructure/websocket/admin-events.gateway';
import { WebSocketNotifier } from './infrastructure/websocket/websocket-notifier.adapter';

/**
 * Módulo compartido de notificaciones (Fase 4). Reúne el puerto de correo
 * (movido desde `auth`, N6), el despachador con fallos aislados (N8) y los dos
 * canales de la Etapa 1: correo al dueño (durable) y WebSocket al panel (tiempo
 * real). Añadir un canal nuevo —p. ej. WhatsApp en la Etapa 2— es sumar un
 * adaptador `NotifierPort` al arreglo `NOTIFIERS`; ningún otro archivo cambia.
 *
 * IMPORTANTE: este módulo NO importa `AuthModule` (evitaría un ciclo: Auth ya
 * depende de él por el correo). El gateway verifica el JWT con su propio
 * `JwtModule` y su propio repositorio de `User`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({ secret: process.env.JWT_SECRET }),
  ],
  providers: [
    {
      // La elección del transporte de correo es explícita por variable de
      // entorno: sin EMAIL_PROVIDER se usa el adaptador de consola (E3).
      provide: EMAIL_SENDER,
      useFactory: () => {
        const provider = (process.env.EMAIL_PROVIDER ?? '').trim();
        return provider.length > 0
          ? new ProviderEmailSenderAdapter()
          : new ConsoleEmailSenderAdapter();
      },
    },
    {
      // Destinatario, zona horaria y enlace al panel del aviso por correo.
      // El destinatario puede diferir de EMAIL_FROM (remitente de la Fase 3a).
      provide: OWNER_NOTIFICATION_CONFIG,
      useFactory: (): OwnerNotificationConfig => ({
        to: process.env.SALON_NOTIFICATION_EMAIL ?? '',
        timeZone: process.env.SALON_TZ ?? 'America/Bogota',
        panelUrl: process.env.ADMIN_PANEL_URL ?? '',
      }),
    },
    AdminEventsGateway,
    OwnerEmailNotifier,
    WebSocketNotifier,
    {
      // El conjunto de canales activos es un dato de configuración, no una
      // condición dispersa por el código: sumar WhatsApp (Etapa 2) será añadir
      // un elemento a este arreglo.
      provide: NOTIFIERS,
      inject: [OwnerEmailNotifier, WebSocketNotifier],
      useFactory: (correo: OwnerEmailNotifier, socket: WebSocketNotifier) => [
        correo,
        socket,
      ],
    },
    NotificationDispatcher,
  ],
  exports: [EMAIL_SENDER, NotificationDispatcher],
})
export class NotificationsModule {}

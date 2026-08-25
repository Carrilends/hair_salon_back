import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from 'src/auth/entities/user.entity';
import {
  CLIENT_WHATSAPP_CONFIG,
  EMAIL_SENDER,
  NOTIFIERS,
  OWNER_NOTIFICATION_CONFIG,
  WHATSAPP_SENDER,
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
import { CloudApiWhatsAppSender } from './infrastructure/whatsapp/cloud-api-whatsapp-sender.adapter';
import { ConsoleWhatsAppSender } from './infrastructure/whatsapp/console-whatsapp-sender.adapter';
import {
  ClientWhatsAppConfig,
  ClientWhatsAppNotifier,
} from './infrastructure/whatsapp/client-whatsapp-notifier.adapter';

/**
 * Módulo compartido de notificaciones (Fase 4). Reúne el puerto de correo
 * (movido desde `auth`, N6), el despachador con fallos aislados (N8) y los
 * canales: correo al dueño (durable) y WebSocket al panel (tiempo real) de la
 * Etapa 1, más el WhatsApp de confirmación a la clienta de la Etapa 2. Añadir un
 * canal nuevo es sumar un adaptador `NotifierPort` al arreglo `NOTIFIERS`; ningún
 * otro archivo cambia.
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
    {
      // Transporte de WhatsApp, elegido por env como el de correo: sin
      // WHATSAPP_TOKEN se usa el adaptador de consola; con token, la Cloud API
      // (arranque perezoso: la app arranca sin credenciales de WhatsApp).
      provide: WHATSAPP_SENDER,
      useFactory: () => {
        const token = (process.env.WHATSAPP_TOKEN ?? '').trim();
        return token.length > 0
          ? new CloudApiWhatsAppSender({
              token,
              phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
              apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
              templateName: process.env.WHATSAPP_TEMPLATE_NAME,
              templateLang: process.env.WHATSAPP_TEMPLATE_LANG ?? 'es_CO',
            })
          : new ConsoleWhatsAppSender();
      },
    },
    {
      // Zona horaria del mensaje de confirmación a la clienta (Bogotá).
      provide: CLIENT_WHATSAPP_CONFIG,
      useFactory: (): ClientWhatsAppConfig => ({
        timeZone: process.env.SALON_TZ ?? 'America/Bogota',
      }),
    },
    AdminEventsGateway,
    OwnerEmailNotifier,
    WebSocketNotifier,
    ClientWhatsAppNotifier,
    {
      // El conjunto de canales activos es un dato de configuración, no una
      // condición dispersa por el código: sumar WhatsApp (Etapa 2) fue añadir
      // un elemento a este arreglo.
      provide: NOTIFIERS,
      inject: [OwnerEmailNotifier, WebSocketNotifier, ClientWhatsAppNotifier],
      useFactory: (
        correo: OwnerEmailNotifier,
        socket: WebSocketNotifier,
        whatsapp: ClientWhatsAppNotifier,
      ) => [correo, socket, whatsapp],
    },
    NotificationDispatcher,
  ],
  exports: [EMAIL_SENDER, NotificationDispatcher],
})
export class NotificationsModule {}

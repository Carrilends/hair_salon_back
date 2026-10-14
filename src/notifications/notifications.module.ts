import { Logger, Module } from '@nestjs/common';
import { imagenDeRespaldo } from './infrastructure/whatsapp/fallback-image';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from 'src/auth/entities/user.entity';
import {
  CLIENT_WHATSAPP_CONFIG,
  EMAIL_SENDER,
  NOTIFIERS,
  OWNER_NOTIFICATION_CONFIG,
  OWNER_WHATSAPP_CONFIG,
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
import {
  OwnerWhatsAppConfig,
  OwnerWhatsAppNotifier,
} from './infrastructure/whatsapp/owner-whatsapp-notifier.adapter';

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
/**
 * Lee y valida la foto de respaldo, y deja dicho en el arranque en qué modo
 * queda el aviso «reserva creada» (plan 06, F1): el interruptor tiene que
 * coincidir con la plantilla configurada, y un desajuste solo se vería después,
 * en los acuses de Meta.
 */
function respaldoDelAviso(): string | undefined {
  const logger = new Logger('NotificationsModule');
  const { url, error } = imagenDeRespaldo(
    process.env.WHATSAPP_FALLBACK_IMAGE_URL,
  );
  if (error) logger.error(error);
  const plantilla = process.env.WHATSAPP_TEMPLATE_RESERVA_CREADA ?? '';
  logger.log(
    url
      ? `Aviso «reserva creada» CON imagen: la plantilla «${plantilla}» debe tener cabecera IMAGE.`
      : `Aviso «reserva creada» SIN imagen: la plantilla «${plantilla}» debe ser de texto.`,
  );
  return url;
}

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
              // El nombre de la plantilla ya NO vive aquí: es del mensaje, no de
              // la aplicación, porque cada aviso usa la suya.
              templateLang: process.env.WHATSAPP_TEMPLATE_LANG ?? 'es_CO',
            })
          : new ConsoleWhatsAppSender();
      },
    },
    {
      // Zona horaria y plantillas de los avisos a la clienta. Una por evento:
      // Meta exige una plantilla aprobada por cada mensaje que inicia el negocio.
      provide: CLIENT_WHATSAPP_CONFIG,
      useFactory: (): ClientWhatsAppConfig => ({
        timeZone: process.env.SALON_TZ ?? 'America/Bogota',
        templateCreated: process.env.WHATSAPP_TEMPLATE_RESERVA_CREADA ?? '',
        templateCancelled:
          process.env.WHATSAPP_TEMPLATE_RESERVA_CANCELADA ?? '',
        templateRescheduled:
          process.env.WHATSAPP_TEMPLATE_RESERVA_REPROGRAMADA ?? '',
        templateConfirmed:
          process.env.WHATSAPP_TEMPLATE_RESERVA_CONFIRMADA ?? '',
        // Vacía = aviso de creación sin imagen (plantilla v1). Ver la config.
        fallbackImageUrl: respaldoDelAviso(),
      }),
    },
    {
      // Aviso a la peluquería. El destinatario es su móvil personal, que NO es
      // el número que la Cloud API consume: sin él, el canal simplemente no
      // existe todavía.
      provide: OWNER_WHATSAPP_CONFIG,
      useFactory: (): OwnerWhatsAppConfig => ({
        ownerPhone: process.env.SALON_OWNER_WHATSAPP ?? '',
        timeZone: process.env.SALON_TZ ?? 'America/Bogota',
        templateName: process.env.WHATSAPP_TEMPLATE_AVISO_DUENA ?? '',
      }),
    },
    AdminEventsGateway,
    OwnerEmailNotifier,
    WebSocketNotifier,
    ClientWhatsAppNotifier,
    OwnerWhatsAppNotifier,
    {
      // El conjunto de canales activos es un dato de configuración, no una
      // condición dispersa por el código: sumar WhatsApp (Etapa 2) fue añadir
      // un elemento a este arreglo.
      provide: NOTIFIERS,
      inject: [
        OwnerEmailNotifier,
        WebSocketNotifier,
        ClientWhatsAppNotifier,
        OwnerWhatsAppNotifier,
      ],
      useFactory: (
        correo: OwnerEmailNotifier,
        socket: WebSocketNotifier,
        whatsappClienta: ClientWhatsAppNotifier,
        whatsappDuena: OwnerWhatsAppNotifier,
      ) => [correo, socket, whatsappClienta, whatsappDuena],
    },
    NotificationDispatcher,
  ],
  // `WHATSAPP_SENDER` sale del módulo porque el canal ENTRANTE necesita
  // responder a la clienta, y el transporte es el mismo en los dos sentidos.
  exports: [EMAIL_SENDER, NotificationDispatcher, WHATSAPP_SENDER],
})
export class NotificationsModule {}

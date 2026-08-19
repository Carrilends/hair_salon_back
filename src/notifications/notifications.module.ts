import { Module } from '@nestjs/common';

import { EMAIL_SENDER, NOTIFIERS } from './application/tokens';
import { NotificationDispatcher } from './application/notification-dispatcher';
import { ConsoleEmailSenderAdapter } from './infrastructure/email/console-email-sender.adapter';
import { ProviderEmailSenderAdapter } from './infrastructure/email/provider-email-sender.adapter';

/**
 * Módulo compartido de notificaciones (Fase 4, N6). Hoy solo alberga el puerto
 * de correo, que la Fase 3a dejó en `auth` como deuda anotada; Auth pasa a ser
 * un consumidor más importando este módulo. En tareas siguientes sumará el
 * despachador (T1), los notificadores de correo/WebSocket y el gateway.
 *
 * IMPORTANTE: este módulo NO debe importar `AuthModule` (evita el ciclo:
 * `AuthModule` ya depende de él por el correo). El gateway de T5 verificará el
 * JWT con `JwtModule` propio, no arrastrando Auth.
 */
@Module({
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
      // Conjunto de canales activos que consume el despachador. Vacío por ahora;
      // T4 y T5 añaden los notificadores de correo y WebSocket, y T6 los cablea
      // aquí. Con el arreglo vacío, notificar es un no-op inofensivo.
      provide: NOTIFIERS,
      useValue: [],
    },
    NotificationDispatcher,
  ],
  exports: [EMAIL_SENDER, NotificationDispatcher],
})
export class NotificationsModule {}

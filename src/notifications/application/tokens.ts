/** Arreglo de notificadores activos que consume el despachador (fan-out). */
export const NOTIFIERS = Symbol('NotifierPort[]');

/**
 * Puerto de envío de correo. Vive aquí (módulo compartido) desde la Fase 4:
 * lo consumen tanto Auth (verificación, reset) como el aviso al dueño (T4).
 */
export const EMAIL_SENDER = Symbol('EmailSenderPort');

/** Configuración del aviso por correo al dueño: destinatario, zona y enlace. */
export const OWNER_NOTIFICATION_CONFIG = Symbol('OwnerNotificationConfig');

/**
 * Puerto de transporte de WhatsApp (Etapa 2). Espejo de `EMAIL_SENDER`: sin
 * `WHATSAPP_TOKEN` el módulo usa el adaptador de consola; con token, la Cloud API.
 */
export const WHATSAPP_SENDER = Symbol('WhatsAppSenderPort');

/** Configuración del WhatsApp de confirmación a la clienta: zona horaria. */
export const CLIENT_WHATSAPP_CONFIG = Symbol('ClientWhatsAppConfig');

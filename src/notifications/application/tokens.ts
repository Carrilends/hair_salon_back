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

/**
 * Destinatario, zona y plantilla del aviso a la peluquería por WhatsApp. Es
 * distinto del de la clienta porque el destinatario es fijo y la plantilla es
 * otra: el número emisor es la línea dedicada de la Cloud API, y este es el
 * móvil personal de Marlene.
 */
export const OWNER_WHATSAPP_CONFIG = Symbol('OWNER_WHATSAPP_CONFIG');

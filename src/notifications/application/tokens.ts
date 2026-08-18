/** Arreglo de notificadores activos que consume el despachador (fan-out). */
export const NOTIFIERS = Symbol('NotifierPort[]');

/**
 * Puerto de envío de correo. Vive aquí (módulo compartido) desde la Fase 4:
 * lo consumen tanto Auth (verificación, reset) como el aviso al dueño (T4).
 */
export const EMAIL_SENDER = Symbol('EmailSenderPort');

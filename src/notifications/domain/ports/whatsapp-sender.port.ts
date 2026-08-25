/**
 * Puerto de transporte de WhatsApp (Etapa 2). Espejo de `EmailSenderPort`: el
 * notificador compone el mensaje y lo entrega a este puerto sin saber qué hay
 * detrás (consola en desarrollo, Cloud API de Meta en producción).
 *
 * El mensaje es estructurado, no texto libre: los mensajes iniciados por el
 * negocio en la Cloud API exigen una plantilla aprobada por Meta, así que el
 * notificador aporta el destinatario (E.164) y los parámetros ordenados del
 * cuerpo de la plantilla; el adaptador real los envuelve en el payload de Graph.
 */
export interface WhatsAppMessage {
  to: string;
  bodyParams: string[];
}

export interface WhatsAppSenderPort {
  send(message: WhatsAppMessage): Promise<void>;
}

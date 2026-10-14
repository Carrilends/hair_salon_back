import { Conversation } from '../conversation';

/**
 * Consultas del historial por número de WhatsApp (plan 06, F3a). Puerto aparte
 * de `ConversationRepositoryPort` a propósito: solo lo necesita el canal de
 * WhatsApp, y separarlo deja intactos a todos los que ya implementan aquél. El
 * adaptador TypeORM implementa los dos.
 */
export interface PhoneConversationRepositoryPort {
  /**
   * La conversación más reciente de ese número con actividad desde `since`, o
   * `null`. Con `since` = ahora − 24 h, una conversación se renueva tras un día
   * de silencio, que es la misma ventana que impone WhatsApp (D2).
   */
  findActiveByPhone(
    phoneE164: string,
    since: Date,
  ): Promise<Conversation | null>;

  /**
   * Mensajes **de la clienta** (`role='user'`) de ese número desde `since`, en
   * todas sus conversaciones. Sustenta el tope por teléfono y día (D7): sin él,
   * el tope por conversación se eludiría esperando a que una caduque.
   */
  countMessagesOfPhoneSince(phoneE164: string, since: Date): Promise<number>;
}

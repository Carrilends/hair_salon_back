import { EntityManager } from 'typeorm';

/** Lo que la eliminación de cuenta necesita del contexto del asistente. */
export interface AccountAssistantDataPort {
  /**
   * Borra las conversaciones del asistente de la cuenta y sus mensajes.
   *
   * Las propuestas de reserva pendientes (`assistant_pending_bookings`) no
   * tienen vínculo con ninguna cuenta: son del canal de WhatsApp y se atan al
   * número (`phone_e164`), que `users` no guarda. No hay, pues, propuestas
   * ligadas a la cuenta que borrar; las de WhatsApp caducan solas a los 15
   * minutos y la purga diaria se las lleva.
   *
   * @returns cuántas conversaciones se borraron.
   */
  purge(tx: EntityManager, userId: string): Promise<number>;
}

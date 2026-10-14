/**
 * Presupuesto de la aplicación (A7). Límite duro por conversación y por usuario
 * y día. Se inyecta como configuración (token `ASSISTANT_BUDGET`) para poder
 * ajustarlo por entorno tras medir el consumo real (T5).
 */
export interface AssistantBudget {
  maxMessagesPerConversation: number;
  maxMessagesPerUserPerDay: number;
  /**
   * Tope de mensajes de la clienta por número de WhatsApp en 24 h (plan 06,
   * D7). Es el equivalente del tope por usuario para quien no tiene cuenta: sin
   * él, el tope por conversación se eludiría esperando a que una caduque.
   * Ausente ⇒ el mismo valor que `maxMessagesPerUserPerDay`.
   */
  maxMessagesPerPhonePerDay?: number;
  /**
   * Techo de tokens facturables (entrada + salida) de TODA la instalación en un
   * día del salón. Es la última red: aunque los topes por conversación, por
   * usuario y por origen fallen, la factura tiene tope.
   *
   * En tokens y no en mensajes porque un mensaje no cuesta nada fijo: un turno
   * son hasta seis llamadas al modelo, y lo que se factura son tokens.
   *
   * `0` = sin techo.
   */
  maxTokensPerDay: number;
}

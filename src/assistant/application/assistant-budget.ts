/**
 * Presupuesto de la aplicación (A7). Límite duro por conversación y por usuario
 * y día. Se inyecta como configuración (token `ASSISTANT_BUDGET`) para poder
 * ajustarlo por entorno tras medir el consumo real (T5).
 */
export interface AssistantBudget {
  maxMessagesPerConversation: number;
  maxMessagesPerUserPerDay: number;
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

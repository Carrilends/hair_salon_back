/**
 * Presupuesto de la aplicación (A7). Límite duro por conversación y por usuario
 * y día. Se inyecta como configuración (token `ASSISTANT_BUDGET`) para poder
 * ajustarlo por entorno tras medir el consumo real (T5).
 */
export interface AssistantBudget {
  maxMessagesPerConversation: number;
  maxMessagesPerUserPerDay: number;
}

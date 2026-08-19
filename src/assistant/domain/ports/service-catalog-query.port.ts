/** Resumen mínimo de un servicio para el asistente (proyección pobre, §6.2). */
export interface AssistantServiceSummary {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

/**
 * Consulta del catálogo **por texto** para el asistente. Distinto del
 * `ServiceCatalogPort` de Reservas (que resuelve snapshots por id): aquí se busca
 * por nombre y se acota el número de resultados. **Nunca** expone
 * `Detail.description` ni `Detail.specifications` (coste impredecible).
 */
export interface ServiceCatalogQueryPort {
  search(
    text: string | undefined,
    limit: number,
  ): Promise<AssistantServiceSummary[]>;
}

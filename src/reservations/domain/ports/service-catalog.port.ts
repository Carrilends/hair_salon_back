/** Snapshot de un servicio del catálogo al momento de reservar. */
export interface ServiceSnapshot {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
}

/**
 * Puerto de consulta al catálogo de servicios. Desacopla el dominio de Reservas
 * de la entidad `Service`: solo recibe los snapshots que necesita para armar las
 * líneas de la reserva.
 */
export interface ServiceCatalogPort {
  getSnapshots(serviceIds: string[]): Promise<ServiceSnapshot[]>;
}

/**
 * Puerto de lectura de las fotos del catálogo (plan 06, F1). Existe solo para
 * que el aviso «reserva creada» por WhatsApp lleve la imagen del servicio, y es
 * propio de Reservas: no reutiliza la consulta del asistente para no acoplar
 * dos contextos que evolucionan por separado.
 */
export interface ServiceImagesPort {
  /**
   * URLs crudas de cada servicio, **con la principal delante**. Sin filtrar:
   * qué URL sirve para WhatsApp lo decide `pickNotificationImage`.
   */
  findImageUrls(serviceIds: string[]): Promise<Map<string, string[]>>;
}

/**
 * Bitácora de los mensajes entrantes ya procesados.
 *
 * Existe por las **reentregas de Meta**: si no respondemos 200 lo bastante
 * rápido, o si algo falla, reenvía el mismo mensaje con backoff durante días.
 *
 * El dominio ya absorbe casi todo el daño de una reentrega —cancelar dos veces
 * choca con el estado terminal, y mover dos veces a la misma hora es
 * idempotente—, así que lo que esta bitácora evita de verdad es **duplicar los
 * mensajes salientes** y confundir a la clienta con tres «tu cita quedó
 * cancelada» seguidos. De paso queda un registro auditable de qué entró y
 * cuándo.
 */
export interface InboundMessageLogPort {
  /**
   * Anota el mensaje si es la primera vez que se ve. Devuelve `true` si hay que
   * procesarlo y `false` si ya estaba: la decisión y el registro son la misma
   * operación atómica, para que dos reentregas simultáneas no pasen las dos.
   */
  markProcessedIfNew(messageId: string, from: string): Promise<boolean>;
  /** Borra lo anterior al corte; la bitácora no tiene por qué crecer sin fin. */
  deleteOlderThan(cutoff: Date): Promise<void>;
}

import { NotifiableEvent } from '../events/reservation-created.event';

/**
 * Puerto de salida único del módulo de notificaciones. Cada canal (correo,
 * WebSocket, y en el futuro WhatsApp) es un adaptador que lo implementa. El
 * dominio no conoce el canal (decisión N3 del plan de la Fase 4).
 */
export interface NotifierPort {
  /** Nombre del canal; solo se usa para registrar fallos de forma legible. */
  readonly channel: string;
  notify(event: NotifiableEvent): Promise<void>;
}

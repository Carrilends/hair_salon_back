import { Injectable } from '@nestjs/common';
import { NotifierPort } from '../../domain/ports/notifier.port';
import { NotifiableEvent } from '../../domain/events/reservation-created.event';
import { AdminEventsGateway, ADMIN_ROOM } from './admin-events.gateway';

/**
 * Canal en tiempo real (N2): emite el evento a la sala `admins`. Emitir a una
 * sala es "dispara y olvida": si no hay nadie conectado no es un error, sólo no
 * hay nadie mirando —para eso está el correo—.
 */
@Injectable()
export class WebSocketNotifier implements NotifierPort {
  readonly channel = 'websocket';

  constructor(private readonly gateway: AdminEventsGateway) {}

  async notify(event: NotifiableEvent): Promise<void> {
    this.gateway.server?.to(ADMIN_ROOM).emit(event.type, event);
  }
}

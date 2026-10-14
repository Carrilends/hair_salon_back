import { Injectable } from '@nestjs/common';
import { ConfirmPendingBookingUseCase } from 'src/assistant/application/confirm-pending-booking.use-case';
import { PendingBookingActionsPort } from '../../domain/ports/pending-booking-actions.port';

/**
 * Puente entre el canal y el caso de uso del asistente que confirma o descarta
 * una propuesta de reserva (plan 06, F4). El canal no conoce la tabla de
 * propuestas; solo pide «confirma ésta, con este número».
 */
@Injectable()
export class PendingBookingActionsAdapter implements PendingBookingActionsPort {
  constructor(private readonly useCase: ConfirmPendingBookingUseCase) {}

  async confirm(id: string, phoneE164: string) {
    const r = await this.useCase.confirm(id, phoneE164);
    return r.ok === true
      ? { ok: true as const, scheduledAt: r.scheduledAt }
      : { ok: false as const, motivo: r.motivo };
  }

  discard(id: string, phoneE164: string) {
    return this.useCase.discard(id, phoneE164);
  }
}

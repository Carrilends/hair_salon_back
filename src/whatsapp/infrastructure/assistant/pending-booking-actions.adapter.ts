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
    if (r.ok === true) return { ok: true as const, scheduledAt: r.scheduledAt };
    // La hora viaja con el motivo cuando el caso de uso la da (la propuesta era
    // de este número y la agenda la rechazó): sin ella el canal no puede decir
    // el horario de ese día (caso de aceptación tras `afd06bb`).
    return {
      ok: false as const,
      motivo: r.motivo,
      ...(r.scheduledAt ? { scheduledAt: r.scheduledAt } : {}),
    };
  }

  discard(id: string, phoneE164: string) {
    return this.useCase.discard(id, phoneE164);
  }
}

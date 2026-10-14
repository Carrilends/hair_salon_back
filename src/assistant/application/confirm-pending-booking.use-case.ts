import { Inject, Injectable } from '@nestjs/common';
import { CreateReservationUseCase } from 'src/reservations/application/create-reservation.use-case';
import { PendingBookingRepositoryPort } from '../domain/ports/pending-booking-repository.port';
import { ClockPort } from '../domain/ports/clock.port';
import { mapDomainErrorToReason } from './tools/create-reservation.tool';
import { ASSISTANT_CLOCK, PENDING_BOOKINGS } from './tokens';

export type ConfirmPendingResult =
  | { ok: true; reservaId?: string; scheduledAt: Date }
  | { ok: false; motivo: string };

/**
 * Lo que hace el botón «Confirmar» de una propuesta de reserva (plan 06, F4,
 * D4). Es la **única** vía por la que una reserva pedida al asistente en
 * WhatsApp llega a la agenda, y no pasa por el modelo.
 *
 * Primero consume la propuesta (atómico: solo un toque gana) y después crea la
 * reserva con el caso de uso de siempre, que comprueba horario, solapes y
 * servicios, y dispara los cuatro avisos —también el del panel web—. Si la hora
 * se ocupó entretanto, la propuesta queda gastada y se le pide otra: el
 * asistente propondrá de nuevo.
 */
@Injectable()
export class ConfirmPendingBookingUseCase {
  constructor(
    @Inject(PENDING_BOOKINGS)
    private readonly pendientes: PendingBookingRepositoryPort,
    private readonly createReservation: CreateReservationUseCase,
    @Inject(ASSISTANT_CLOCK) private readonly clock: ClockPort,
  ) {}

  async confirm(id: string, phoneE164: string): Promise<ConfirmPendingResult> {
    const consumida = await this.pendientes.consume(
      id,
      phoneE164,
      this.clock.now(),
      'confirmada',
    );
    if (consumida.ok === false) {
      return { ok: false, motivo: consumida.motivo };
    }
    const p = consumida.booking;

    try {
      const reserva = await this.createReservation.execute({
        scheduledAt: p.scheduledAt.toISOString(),
        serviceIds: p.serviceIds,
        // D3: a nombre del número firmado, nunca de una cuenta.
        userId: null,
        contact: { name: p.customerName, phone: p.phoneE164 },
      });
      return { ok: true, reservaId: reserva.id, scheduledAt: p.scheduledAt };
    } catch (error) {
      return { ok: false, motivo: mapDomainErrorToReason(error) };
    }
  }

  /** «Cambiar»: la propuesta se gasta sin crear nada. */
  async discard(
    id: string,
    phoneE164: string,
  ): Promise<{ ok: true } | { ok: false; motivo: string }> {
    const r = await this.pendientes.consume(
      id,
      phoneE164,
      this.clock.now(),
      'descartada',
    );
    return r.ok === false ? { ok: false, motivo: r.motivo } : { ok: true };
  }
}

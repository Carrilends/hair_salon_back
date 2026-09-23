import { Injectable } from '@nestjs/common';
import { WorkersService } from 'src/workers/workers.service';
import { Reservation } from 'src/reservations/domain/reservation';
import { ReservationActor } from 'src/reservations/domain/reservation-actor';
import { CancelReservationUseCase } from 'src/reservations/application/cancel-reservation.use-case';
import { RescheduleReservationUseCase } from 'src/reservations/application/reschedule-reservation.use-case';
import { ConfirmReservationUseCase } from 'src/reservations/application/confirm-reservation.use-case';
import { FindActionableReservationsUseCase } from 'src/reservations/application/find-actionable-reservations.use-case';
import { GetReservationUseCase } from 'src/reservations/application/get-reservation.use-case';
import { getDatePartsInTz, getSalonNow } from 'src/reservations/salon-time';
import {
  ReservationActionsPort,
  ReservationSummary,
} from '../../domain/ports/reservation-actions.port';
import { freeStartTimes } from '../../application/slot-options';

/** Cuántos días adelante se mira antes de rendirse buscando hueco. */
const HORIZONTE_DIAS = 60;

/**
 * Traduce el idioma del canal al del contexto de Reservas. Aquí no hay ninguna
 * regla de negocio: delega en los **mismos** casos de uso que usan el portal y
 * el asistente, de modo que las tres puertas no puedan divergir.
 */
@Injectable()
export class ReservationActionsAdapter implements ReservationActionsPort {
  constructor(
    private readonly findActionable: FindActionableReservationsUseCase,
    private readonly getReservation: GetReservationUseCase,
    private readonly cancelUseCase: CancelReservationUseCase,
    private readonly rescheduleUseCase: RescheduleReservationUseCase,
    private readonly confirmUseCase: ConfirmReservationUseCase,
    private readonly workers: WorkersService,
  ) {}

  async findActionableByPhone(
    phoneE164: string,
  ): Promise<ReservationSummary[]> {
    const reservas = await this.findActionable.execute(phoneE164);
    return Promise.all(reservas.map((r) => this.toSummary(r)));
  }

  async findById(id: string): Promise<ReservationSummary | null> {
    const reserva = await this.getReservation.execute(id);
    return reserva ? this.toSummary(reserva) : null;
  }

  async cancel(id: string, actor: ReservationActor): Promise<void> {
    await this.cancelUseCase.execute(id, actor);
  }

  async reschedule(
    id: string,
    scheduledAtIso: string,
    actor: ReservationActor,
  ): Promise<void> {
    await this.rescheduleUseCase.execute(id, scheduledAtIso, actor);
  }

  async confirm(id: string): Promise<void> {
    await this.confirmUseCase.execute(id);
  }

  async daysWithAvailability(
    workerId: string,
    durationMinutes: number,
    now: Date,
    max: number,
  ): Promise<string[]> {
    const dias: string[] = [];

    // Se recorre día a día porque la disponibilidad se calcula por fecha; el
    // horizonte acota el coste cuando la agenda está llena. Se corta en cuanto
    // hay suficientes para llenar la lista.
    for (let i = 0; i < HORIZONTE_DIAS && dias.length < max; i++) {
      const ymd = this.sumarDias(now, i);
      const horas = await this.slotsFor(ymd, workerId, durationMinutes);
      if (horas.length > 0) dias.push(ymd);
    }

    return dias;
  }

  async slotsFor(
    dateYmd: string,
    workerId: string,
    durationMinutes: number,
  ): Promise<string[]> {
    const disponibilidad = await this.workers.getAvailabilityByDate(dateYmd);
    // El estilista de la cita, no el de por defecto.
    //
    // **Ojo: esto ofrece de menos.** Era exacto cuando mover una cita nunca la
    // reasignaba. Ya no: una reserva sin estilista elegida puede moverse a una
    // hora en la que su estilista actual está ocupada pero otra está libre, y
    // esas horas no aparecen aquí. Es conservador —nunca ofrece una hora que
    // luego se rechace— pero se queda corto justo en los casos en los que la
    // reprogramación ya sabe decir que sí.
    //
    // Arreglarlo es una **consulta**, no la regla de solape (que vive en el caso
    // de uso y no se duplica aquí): habría que mirar la ocupación con criterio
    // de salón cuando la reserva no está marcada, con la misma fuente que ya usa
    // el asistente (`AvailabilityQueryAdapter`: `ocupacionSimultanea` +
    // `assignableWorkers`). Queda pendiente de decidir si ese cálculo se
    // generaliza a un puerto compartido o se acepta una segunda implementación.
    const suyo = disponibilidad.workers.find((w) => w.id === workerId);
    if (!suyo) return [];

    return freeStartTimes(
      {
        effectiveStartMin: disponibilidad.dayBounds.effectiveStartMin,
        closeMin: disponibilidad.dayBounds.closeMin,
        busyBlocks: (suyo.reservations ?? []).map((b) => ({
          startMin: b.startMin,
          endMin: b.endMin,
        })),
      },
      durationMinutes,
    );
  }

  private async toSummary(r: Reservation): Promise<ReservationSummary> {
    return {
      id: r.id!,
      scheduledAt: r.scheduledAt,
      status: r.status,
      workerId: r.workerId,
      workerName: await this.workers.getWorkerName(r.workerId),
      workerPinned: r.workerPinned,
      totalDurationMinutes: r.totalDurationMinutes,
      serviceNames: r.lines.map((l) => l.name),
    };
  }

  /** `YYYY-MM-DD` del día `n` después de hoy, en la zona del salón. */
  private sumarDias(now: Date, n: number): string {
    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const hoy = getSalonNow(tz);
    const [y, m, d] = hoy.ymd.split('-').map(Number);
    const destino = new Date(Date.UTC(y, m - 1, d + n, 12));
    const partes = getDatePartsInTz(destino, tz);
    return `${partes.year}-${pad2(partes.month)}-${pad2(partes.day)}`;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

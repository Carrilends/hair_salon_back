import { Inject, Injectable, Logger } from '@nestjs/common';
import { InvalidAbsenceError } from '../../domain/errors';
import { ClockPort } from '../../domain/ports/clock.port';
import { ReservationNotifierPort } from '../../domain/ports/reservation-notifier.port';
import { ReservationRepositoryPort } from '../../domain/ports/reservation-repository.port';
import { WorkerAbsenceRepositoryPort } from '../../domain/ports/worker-absence-repository.port';
import { WorkerAbsence } from '../../domain/worker-absence';
import {
  CLOCK,
  RESERVATION_NOTIFIER,
  RESERVATION_REPOSITORY,
  WORKER_ABSENCES,
} from '../tokens';
import { AbsenceImpact, AbsencePlan, AbsencePlanner } from './absence-planner';
import { AbsenceCommand } from './preview-absence.use-case';

export type MarkAbsenceResult = AbsencePlan & {
  absenceId: string;
  /** Citas que no se pudieron mover ni cancelar; la dueña las resuelve a mano. */
  sinResolver: string[];
};

/**
 * Aplica una ausencia: la guarda y mueve o cancela cada cita afectada,
 * avisando una por una con el motivo.
 *
 * Se guarda **primero**: desde ese instante ninguna puerta reserva con la
 * estilista ausente, así que el plan que se ejecuta (calculado de nuevo, con la
 * agenda de ahora) no puede quedarse viejo por reservas nuevas. Cada cita se
 * resuelve por separado: si una falla (p. ej. una carrera que la restricción de
 * exclusión rechaza) se anota en `sinResolver` y se sigue con las demás.
 */
@Injectable()
export class MarkAbsenceUseCase {
  private readonly logger = new Logger(MarkAbsenceUseCase.name);

  constructor(
    @Inject(WORKER_ABSENCES)
    private readonly absences: WorkerAbsenceRepositoryPort,
    @Inject(RESERVATION_REPOSITORY)
    private readonly reservations: ReservationRepositoryPort,
    private readonly planner: AbsencePlanner,
    @Inject(RESERVATION_NOTIFIER)
    private readonly notifier: ReservationNotifierPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  execute(cmd: AbsenceCommand): Promise<MarkAbsenceResult> {
    const absence = WorkerAbsence.create({
      ...cmd,
      now: this.clock.now(),
      tz: process.env.SALON_TZ ?? 'America/Bogota',
    });
    return this.aplicar(absence);
  }

  /** Para la propuesta de WhatsApp: reconstruye la ausencia desde su ventana. */
  async executeExact(input: {
    workerId: string;
    startsAt: Date;
    endsAt: Date;
  }): Promise<MarkAbsenceResult> {
    if (input.endsAt.getTime() <= this.clock.now().getTime()) {
      throw new InvalidAbsenceError('esa franja ya pasó');
    }
    return this.aplicar(WorkerAbsence.fromWindow(input));
  }

  private async aplicar(absence: WorkerAbsence): Promise<MarkAbsenceResult> {
    // Valida la estilista (existe, no es la de por defecto) antes de guardar:
    // el plan se descarta, solo importa que no lance.
    await this.planner.planear(absence, this.clock.now());

    // El cruce con otra ausencia lo rechaza el repositorio (restricción de
    // exclusión) y no se emite ningún aviso.
    const saved = await this.absences.save(absence);

    const now = this.clock.now();
    const plan = await this.planner.planear(saved, now);
    const absenceMeta = { absentWorkerName: plan.workerName };
    const sinResolver: string[] = [];

    for (const impact of plan.impacts) {
      try {
        await this.resolver(impact, absenceMeta, now);
      } catch (err) {
        this.logger.error(
          `Ausencia ${saved.id}: no se pudo resolver la reserva ${impact.reservationId}`,
          err as Error,
        );
        sinResolver.push(impact.reservationId);
      }
    }

    return { ...plan, absenceId: saved.id!, sinResolver };
  }

  private async resolver(
    impact: AbsenceImpact,
    absence: { absentWorkerName: string },
    now: Date,
  ): Promise<void> {
    const reservation = await this.reservations.findById(impact.reservationId);
    if (!reservation) throw new Error('la reserva ya no existe');

    if (impact.outcome === 'reasignada') {
      reservation.reassignForAbsence(impact.newWorkerId!);
      const saved = await this.reservations.save(reservation);
      await this.avisar(impact.reservationId, () =>
        this.notifier.reservationRescheduled(saved, {
          byAdmin: true,
          // La hora no cambia; solo la estilista.
          previousScheduledAt: saved.scheduledAt,
          workerChanged: true,
          absence,
        }),
      );
    } else {
      reservation.cancel({ byAdmin: true, now });
      const saved = await this.reservations.save(reservation);
      await this.avisar(impact.reservationId, () =>
        this.notifier.reservationCancelled(saved, { byAdmin: true, absence }),
      );
    }
  }

  /** La cita ya cambió: un canal caído no puede deshacerlo (NF11). */
  private async avisar(id: string, enviar: () => Promise<void>): Promise<void> {
    try {
      await enviar();
    } catch (err) {
      this.logger.error(
        `Reserva ${id} resuelta por ausencia, pero falló la notificación`,
        err as Error,
      );
    }
  }
}

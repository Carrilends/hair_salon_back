import { Inject, Injectable, Logger } from '@nestjs/common';
import { InvalidAbsenceError, WorkerOverlapError } from '../../domain/errors';
import { canReschedule } from '../../domain/reservation-status';
import { WorkerAvailabilityPort } from '../../domain/ports/worker-availability.port';
import { Reservation } from '../../domain/reservation';
import { WorkerAssigner } from '../worker-assigner';
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
  WORKER_AVAILABILITY,
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
 * decide **en vivo**, en serie: el plan solo dice qué citas mirar, porque entre
 * un aviso y otro una clienta pudo mover la suya. Si una reasignación falla al
 * guardar (p. ej. una carrera que la restricción de exclusión rechaza) se
 * cancela esa cita y se avisa; solo si tampoco eso se puede va a `sinResolver`.
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
    private readonly assigner: WorkerAssigner,
    @Inject(WORKER_AVAILABILITY)
    private readonly workers: WorkerAvailabilityPort,
  ) {}

  async execute(cmd: AbsenceCommand): Promise<MarkAbsenceResult> {
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

    let plan: AbsencePlan;
    try {
      plan = await this.planner.planear(saved, this.clock.now());
    } catch (err) {
      // Aún no se tocó ninguna cita: no dejar una ausencia a medio aplicar.
      await this.absences
        .delete(saved.id!)
        .catch((e) =>
          this.logger.error(
            `No se pudo deshacer la ausencia ${saved.id}`,
            e as Error,
          ),
        );
      throw err;
    }

    const absenceMeta = { absentWorkerName: plan.workerName };
    const impacts: AbsenceImpact[] = [];
    const sinResolver: string[] = [];

    for (const candidata of plan.impacts) {
      try {
        const hecho = await this.resolver(candidata, saved, absenceMeta);
        if (hecho) impacts.push(hecho);
      } catch (err) {
        this.logger.error(
          `Ausencia ${saved.id}: no se pudo resolver la reserva ${candidata.reservationId}`,
          err as Error,
        );
        sinResolver.push(candidata.reservationId);
      }
    }

    return { ...plan, impacts, absenceId: saved.id!, sinResolver };
  }

  /** Devuelve lo que realmente pasó, o `null` si la cita ya no está afectada. */
  private async resolver(
    candidata: AbsenceImpact,
    absence: WorkerAbsence,
    meta: { absentWorkerName: string },
  ): Promise<AbsenceImpact | null> {
    const now = this.clock.now();
    const reservation = await this.reservations.findById(
      candidata.reservationId,
    );
    if (
      !reservation ||
      !canReschedule(reservation.status) ||
      reservation.workerId !== absence.workerId ||
      !absence.overlaps(reservation.scheduledAt, reservation.endedAt) ||
      reservation.scheduledAt.getTime() < now.getTime()
    ) {
      return null;
    }

    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    let nuevaId: string | null = null;
    try {
      nuevaId = await this.assigner.elegir(
        reservation.scheduledAt,
        reservation.endedAt,
        tz,
        {
          excludeReservationId: reservation.id,
          excludeWorkerIds: [absence.workerId],
        },
      );
    } catch (err) {
      if (!(err instanceof WorkerOverlapError)) throw err;
    }

    if (nuevaId) {
      const previousScheduledAt = reservation.scheduledAt;
      let movida: Reservation | null = null;
      try {
        reservation.reassignForAbsence(nuevaId);
        movida = await this.reservations.save(reservation);
      } catch (err) {
        // Una carrera pudo ocupar a esa estilista: la cita no se queda en
        // silencio, se cancela y se avisa.
        this.logger.warn(
          `Reserva ${candidata.reservationId}: falló la reasignación, se cancela: ${(err as Error).message}`,
        );
      }
      if (movida) {
        const guardada = movida;
        await this.avisar(candidata.reservationId, () =>
          this.notifier.reservationRescheduled(guardada, {
            byAdmin: true,
            // La hora no cambia; solo la estilista.
            previousScheduledAt,
            workerChanged: true,
            absence: meta,
          }),
        );
        return {
          ...candidata,
          outcome: 'reasignada',
          newWorkerId: nuevaId,
          newWorkerName: (await this.workers.findWorker(nuevaId))?.name ?? '',
        };
      }
    }

    const fresca =
      (await this.reservations.findById(candidata.reservationId)) ??
      reservation;
    fresca.cancel({ byAdmin: true, now });
    const saved = await this.reservations.save(fresca);
    await this.avisar(candidata.reservationId, () =>
      this.notifier.reservationCancelled(saved, {
        byAdmin: true,
        absence: meta,
      }),
    );
    const resto = { ...candidata, outcome: 'cancelada' as const };
    delete resto.newWorkerId;
    delete resto.newWorkerName;
    return resto;
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

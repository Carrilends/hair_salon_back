import { Inject, Injectable } from '@nestjs/common';
import {
  DefaultWorkerAbsenceError,
  WorkerNotFoundError,
  WorkerOverlapError,
} from '../../domain/errors';
import { ReservationRepositoryPort } from '../../domain/ports/reservation-repository.port';
import { WorkerAvailabilityPort } from '../../domain/ports/worker-availability.port';
import { WorkerAbsence } from '../../domain/worker-absence';
import { RESERVATION_REPOSITORY, WORKER_AVAILABILITY } from '../tokens';
import { WorkerAssigner } from '../worker-assigner';

export type AbsenceOutcome = 'reasignada' | 'cancelada';

export interface AbsenceImpact {
  reservationId: string;
  scheduledAt: Date;
  endedAt: Date;
  customerName: string;
  customerPhone: string | null;
  services: string[];
  outcome: AbsenceOutcome;
  newWorkerId?: string;
  newWorkerName?: string;
}

export interface AbsencePlan {
  workerId: string;
  workerName: string;
  startsAt: Date;
  endsAt: Date;
  impacts: AbsenceImpact[];
}

/**
 * Planifica —sin guardar ni avisar nada— qué pasa con cada cita afectada por
 * una ausencia: pasa a otra estilista libre a la misma hora (aunque la clienta
 * hubiera fijado a la ausente) o, si no hay ninguna libre, se cancela.
 *
 * Recorre las citas en orden y va acumulando las reasignaciones ya planeadas
 * (`ocupadas`): dos citas a la misma hora no pueden caer en la misma estilista
 * libre, y como esas reasignaciones aún no están en la base, el reparto no las
 * vería. La vista previa y la ejecución comparten este plan para no divergir.
 *
 * No comprueba el cruce con otras ausencias de la misma estilista: eso es de
 * quien guarda la ausencia, y comprobarlo aquí lo haría fallar al re-planear
 * una ausencia ya guardada.
 */
@Injectable()
export class AbsencePlanner {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(WORKER_AVAILABILITY)
    private readonly workers: WorkerAvailabilityPort,
    private readonly assigner: WorkerAssigner,
  ) {}

  async planear(absence: WorkerAbsence, now: Date): Promise<AbsencePlan> {
    const ausente = await this.workers.findWorker(absence.workerId);
    if (!ausente) throw new WorkerNotFoundError(absence.workerId);
    if (ausente.isDefault) throw new DefaultWorkerAbsenceError();

    const afectadas = await this.repository.findAffectedByAbsence(
      absence.workerId,
      absence.startsAt,
      absence.endsAt,
      now,
    );

    const tz = process.env.SALON_TZ ?? 'America/Bogota';
    const ocupadas: { workerId: string; start: Date; end: Date }[] = [];
    const nombres = new Map<string, string>();
    const impacts: AbsenceImpact[] = [];

    for (const r of afectadas) {
      const base = {
        reservationId: r.id!,
        scheduledAt: r.scheduledAt,
        endedAt: r.endedAt,
        // Mismo texto que el adaptador de avisos para quien no dejó contacto.
        customerName: r.contact?.name ?? 'Cliente registrado',
        customerPhone: r.contact?.phone ?? null,
        services: r.lines.map((l) => l.name),
      };
      try {
        const nuevaId = await this.assigner.elegir(
          r.scheduledAt,
          r.endedAt,
          tz,
          {
            excludeReservationId: r.id,
            excludeWorkerIds: [absence.workerId],
            ocupadas,
          },
        );
        ocupadas.push({
          workerId: nuevaId,
          start: r.scheduledAt,
          end: r.endedAt,
        });
        if (!nombres.has(nuevaId)) {
          nombres.set(
            nuevaId,
            (await this.workers.findWorker(nuevaId))?.name ?? '',
          );
        }
        impacts.push({
          ...base,
          outcome: 'reasignada',
          newWorkerId: nuevaId,
          newWorkerName: nombres.get(nuevaId),
        });
      } catch (err) {
        if (!(err instanceof WorkerOverlapError)) throw err;
        impacts.push({ ...base, outcome: 'cancelada' });
      }
    }

    return {
      workerId: absence.workerId,
      workerName: ausente.name,
      startsAt: absence.startsAt,
      endsAt: absence.endsAt,
      impacts,
    };
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { WorkerOverlapError } from '../domain/errors';
import { ReservationRepositoryPort } from '../domain/ports/reservation-repository.port';
import { WorkerAvailabilityPort } from '../domain/ports/worker-availability.port';
import { getDatePartsInTz } from '../salon-time';
import { RESERVATION_REPOSITORY, WORKER_AVAILABILITY } from './tokens';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Elige la estilista que atenderá una reserva que no pidió ninguna.
 *
 * **Por qué existe como pieza aparte.** Nació dentro de `CreateReservationUseCase`,
 * pero la reprogramación necesita el **mismo** reparto con una sola diferencia
 * (excluirse a sí misma), y las dos alternativas eran peores: copiarlo garantiza
 * que los dos caminos diverjan, y hacer que un caso de uso llame a otro los
 * acopla. Vive en `application/` y no en `domain/` porque depende de dos puertos
 * —no es dominio puro como `ReservationScheduling`, que por eso se instancia con
 * `new`—.
 *
 * **Por qué hace falta repartir.** La restricción de exclusión de `reservations`
 * es *por estilista* (`worker_id WITH =, tstzrange(...) WITH &&`). Mandar al
 * pseudo-estilista por defecto todo lo que llega sin `workerId` dejaba al salón
 * con capacidad efectiva 1: Postgres rechazaba la segunda cita simultánea aunque
 * hubiera sillas libres. Llegan sin `workerId` el chat (RF57/RF58 no hablan de
 * estilistas) y el portal cuando la clienta marca «Sin preferencia». En ninguno
 * de los dos casos la clienta ha elegido: el reparto es interno.
 *
 * **Criterio.** Entre las libres, la que menos minutos tenga ocupados ese día.
 * No es una optimización sino equidad: sin criterio, el orden de la consulta
 * cargaría siempre a la primera. El desempate por `id` hace la elección
 * determinista y, por tanto, comprobable.
 */
@Injectable()
export class WorkerAssigner {
  constructor(
    @Inject(RESERVATION_REPOSITORY)
    private readonly repository: ReservationRepositoryPort,
    @Inject(WORKER_AVAILABILITY)
    private readonly workers: WorkerAvailabilityPort,
  ) {}

  /**
   * Devuelve el id de la primera estilista libre en la ventana dada.
   *
   * Lanza `WorkerOverlapError` si ninguna lo está: no hay cola ni sobrecupo, el
   * salón no puede atender más de lo que puede. Si no hay estilistas asignables
   * dadas de alta cae en el estilista por defecto, que es lo único posible y es
   * también el caso del salón recién instalado.
   *
   * `excludeReservationId` es lo que necesita la reprogramación: al mover una
   * cita a una ventana que se solapa con la suya actual, su propia fila haría
   * parecer ocupada a su estilista y la sacaría del reparto. La creación no lo
   * pasa porque su reserva todavía no existe.
   */
  async elegir(
    scheduledAt: Date,
    endedAt: Date,
    tz: string,
    opts?: { excludeReservationId?: string },
  ): Promise<string> {
    const p = getDatePartsInTz(scheduledAt, tz);
    const dateYmd = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;

    const cargas = await this.workers.listAssignableWorkloads(dateYmd);
    if (cargas.length === 0) return this.workers.getDefaultWorkerId();

    const candidatas = [...cargas].sort(
      (a, b) => a.usedMinutes - b.usedMinutes || a.id.localeCompare(b.id),
    );

    // En serie y no en paralelo a propósito: en cuanto una sirve, las demás
    // consultas sobran, y son pocas (el salón tiene un puñado de estilistas).
    for (const candidata of candidatas) {
      const solapes = await this.repository.countOverlaps(
        candidata.id,
        scheduledAt,
        endedAt,
        opts?.excludeReservationId,
      );
      if (solapes === 0) return candidata.id;
    }

    throw new WorkerOverlapError();
  }
}

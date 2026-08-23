import { Injectable } from '@nestjs/common';
import { WorkersService } from 'src/workers/workers.service';
import {
  AvailabilityQueryPort,
  DayAvailability,
} from '../../domain/ports/availability-query.port';

/**
 * Adaptador secundario: envuelve `WorkersService.getAvailabilityByDate` y lo
 * reduce a lo que el asistente necesita. `busyBlocks` = los bloques del estilista
 * por defecto, que es a quien la reserva conversacional se asigna (la autoridad
 * sobre la validez de una hora sigue siendo `CreateReservationUseCase`, A6).
 */
@Injectable()
export class AvailabilityQueryAdapter implements AvailabilityQueryPort {
  constructor(private readonly workers: WorkersService) {}

  async getDayAvailability(dateYmd: string): Promise<DayAvailability> {
    const a = await this.workers.getAvailabilityByDate(dateYmd);
    const def = a.workers.find((w) => w.isDefault);
    return {
      dateYmd,
      effectiveStartMin: a.dayBounds.effectiveStartMin,
      closeMin: a.dayBounds.closeMin,
      assignableWorkers: a.workers.filter((w) => w.assignable).length,
      busyBlocks: (def?.reservations ?? []).map((b) => ({
        startMin: b.startMin,
        endMin: b.endMin,
      })),
    };
  }
}

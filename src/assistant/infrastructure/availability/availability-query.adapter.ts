import { Injectable } from '@nestjs/common';
import { ReservationBlock, WorkersService } from 'src/workers/workers.service';
import {
  AvailabilityBusySegment,
  AvailabilityQueryPort,
  DayAvailability,
} from '../../domain/ports/availability-query.port';

/**
 * Adaptador secundario: envuelve `WorkersService.getAvailabilityByDate` y lo
 * reduce a lo que el asistente necesita.
 *
 * La ocupación se mide sobre **todas** las agendas del salón, no sobre una:
 * antes se tomaban los bloques del trabajador por defecto (`Sin prefencia`),
 * que es justamente el que no es asignable, así que una cita de Alejandro
 * creada en el portal era invisible para el chat. Cada reserva, sea de una
 * estilista nombrada o de `Sin prefencia`, es una clienta a la que alguien
 * atiende, así que todas suman a la ocupación simultánea; cuántas caben a la vez
 * lo dice `assignableWorkers`. La autoridad sobre la validez de una hora sigue
 * siendo `CreateReservationUseCase` (A6).
 */
@Injectable()
export class AvailabilityQueryAdapter implements AvailabilityQueryPort {
  constructor(private readonly workers: WorkersService) {}

  async getDayAvailability(dateYmd: string): Promise<DayAvailability> {
    const a = await this.workers.getAvailabilityByDate(dateYmd);
    return {
      dateYmd,
      effectiveStartMin: a.dayBounds.effectiveStartMin,
      closeMin: a.dayBounds.closeMin,
      assignableWorkers: a.workers.filter((w) => w.assignable).length,
      busySegments: ocupacionSimultanea(
        a.workers.map((w) => w.reservations ?? []),
      ),
    };
  }
}

/**
 * Barrido que convierte las agendas del día en tramos disjuntos con cuántas
 * personas están ocupadas a la vez en cada uno. Solo se emiten los tramos con
 * alguien ocupado; los huecos se quedan fuera.
 */
function ocupacionSimultanea(
  agendas: ReservationBlock[][],
): AvailabilityBusySegment[] {
  const eventos: { min: number; delta: number }[] = [];
  for (const agenda of agendas) {
    for (const bloque of fundir(agenda)) {
      eventos.push({ min: bloque.startMin, delta: 1 });
      eventos.push({ min: bloque.endMin, delta: -1 });
    }
  }
  if (eventos.length === 0) return [];

  // A igual minuto, los cierres antes que las aperturas: dos citas que se tocan
  // no deben inflar el recuento en ese instante.
  eventos.sort((a, b) => a.min - b.min || a.delta - b.delta);

  const segmentos: AvailabilityBusySegment[] = [];
  let ocupados = 0;
  let desde = eventos[0].min;
  for (const ev of eventos) {
    if (ev.min > desde && ocupados > 0) {
      segmentos.push({
        startMin: desde,
        endMin: ev.min,
        busyWorkers: ocupados,
      });
    }
    ocupados += ev.delta;
    desde = ev.min;
  }
  return segmentos;
}

/**
 * Une los bloques solapados o contiguos de una misma agenda. Una persona ocupa
 * una sola agenda aunque encadene dos citas, así que sin esto una clienta con
 * dos servicios seguidos contaría como dos estilistas ocupadas.
 */
function fundir(bloques: ReservationBlock[]): ReservationBlock[] {
  const ordenados = bloques
    .filter((b) => b.endMin > b.startMin)
    .sort((a, b) => a.startMin - b.startMin);

  const fundidos: ReservationBlock[] = [];
  for (const bloque of ordenados) {
    const ultimo = fundidos[fundidos.length - 1];
    if (ultimo && bloque.startMin <= ultimo.endMin) {
      ultimo.endMin = Math.max(ultimo.endMin, bloque.endMin);
    } else {
      fundidos.push({ ...bloque });
    }
  }
  return fundidos;
}

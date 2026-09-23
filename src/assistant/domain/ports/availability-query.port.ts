/**
 * Tramo de ocupación simultánea del salón: entre `startMin` y `endMin` (minutos
 * desde medianoche, hora del salón) hay exactamente `busyWorkers` agendas
 * ocupadas a la vez.
 *
 * Deliberadamente **sin identidades**: al asistente le basta con saber si queda
 * sitio, y RF57 no pide nombrar a nadie. Un tramo con `busyWorkers` menor que el
 * número de estilistas asignables **no** cierra la franja: todavía hay alguien
 * libre que puede atender.
 */
export interface AvailabilityBusySegment {
  startMin: number;
  endMin: number;
  busyWorkers: number;
}

/**
 * Disponibilidad de un día ya reducida a lo que el asistente necesita para
 * proponer franjas: el rango efectivo del día, cuántos estilistas asignables hay
 * y cuánta ocupación simultánea soporta cada tramo. La autoridad sobre si una
 * hora concreta es válida sigue siendo `CreateReservationUseCase` (A6).
 */
export interface DayAvailability {
  dateYmd: string;
  effectiveStartMin: number;
  closeMin: number;
  assignableWorkers: number;
  busySegments: AvailabilityBusySegment[];
}

export interface AvailabilityQueryPort {
  getDayAvailability(dateYmd: string): Promise<DayAvailability>;
}

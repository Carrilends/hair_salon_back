/** Bloque ocupado (minutos desde medianoche, hora del salón). */
export interface AvailabilityBusyBlock {
  startMin: number;
  endMin: number;
}

/**
 * Disponibilidad de un día ya reducida a lo que el asistente necesita para
 * proponer franjas: el rango efectivo del día, cuántos estilistas asignables hay
 * y los bloques ya ocupados. La autoridad sobre si una hora concreta es válida
 * sigue siendo `CreateReservationUseCase` (A6).
 */
export interface DayAvailability {
  dateYmd: string;
  effectiveStartMin: number;
  closeMin: number;
  assignableWorkers: number;
  busyBlocks: AvailabilityBusyBlock[];
}

export interface AvailabilityQueryPort {
  getDayAvailability(dateYmd: string): Promise<DayAvailability>;
}

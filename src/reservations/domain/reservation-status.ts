import { InvalidStatusTransitionError } from './errors';

/**
 * Estados del ciclo de vida de una reserva (fuente de verdad §6.4).
 * El valor de cada estado se persiste tal cual en la columna `status`.
 */
export enum ReservationStatus {
  Pendiente = 'pendiente',
  Confirmada = 'confirmada',
  Cumplida = 'cumplida',
  Cancelada = 'cancelada',
}

/** Transiciones permitidas. `cumplida` y `cancelada` son estados terminales. */
const ALLOWED: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.Pendiente]: [
    ReservationStatus.Confirmada,
    ReservationStatus.Cancelada,
  ],
  [ReservationStatus.Confirmada]: [
    ReservationStatus.Cumplida,
    ReservationStatus.Cancelada,
  ],
  [ReservationStatus.Cumplida]: [],
  [ReservationStatus.Cancelada]: [],
};

export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

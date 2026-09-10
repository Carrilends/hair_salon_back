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

/** Estados de los que ya no se sale: la reserva terminó su ciclo. */
export function isTerminal(status: ReservationStatus): boolean {
  return ALLOWED[status].length === 0;
}

/**
 * ¿Se puede mover esta reserva en el tiempo?
 *
 * Reprogramar **no es una transición de estado**: cambia la ventana y conserva
 * el estado, así que no puede apoyarse en `canTransition`, que rechazaría la
 * auto-transición `pendiente → pendiente`. Lo único que impide mover una reserva
 * es que ya haya terminado su ciclo.
 */
export function canReschedule(status: ReservationStatus): boolean {
  return !isTerminal(status);
}

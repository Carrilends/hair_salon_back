export class DomainError extends Error {}

export class OutOfBusinessHoursError extends DomainError {
  constructor() {
    super('La reserva está fuera del horario laboral del salón');
    this.name = 'OutOfBusinessHoursError';
  }
}

export class WorkerOverlapError extends DomainError {
  constructor() {
    super('El estilista ya tiene una reserva en ese horario');
    this.name = 'WorkerOverlapError';
  }
}

export class ReservationNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Reservation ${id} not found`);
    this.name = 'ReservationNotFoundError';
  }
}

export class InvalidReservationError extends DomainError {}

export class InvalidStatusTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Transición de estado inválida: ${from} → ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}

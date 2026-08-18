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

export class EmptyServicesError extends DomainError {
  constructor() {
    super('La reserva debe incluir al menos un servicio');
    this.name = 'EmptyServicesError';
  }
}

export class MissingContactError extends DomainError {
  constructor() {
    super('Una reserva sin usuario autenticado requiere datos de contacto');
    this.name = 'MissingContactError';
  }
}

export class CancellationTooLateError extends DomainError {
  constructor() {
    super('La reserva ya no puede cancelarse: la hora de inicio ya pasó');
    this.name = 'CancellationTooLateError';
  }
}

export class ReservationInThePastError extends DomainError {
  constructor() {
    super('La reserva no puede programarse en el pasado');
    this.name = 'ReservationInThePastError';
  }
}

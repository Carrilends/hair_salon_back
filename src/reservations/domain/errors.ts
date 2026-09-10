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

export class DuplicateServicesError extends DomainError {
  constructor() {
    super('La reserva no puede repetir el mismo servicio');
    this.name = 'DuplicateServicesError';
  }
}

/**
 * El actor no es dueño de la reserva sobre la que quiere actuar. Es un error de
 * dominio y no una `ForbiddenException` de Nest: la capa de aplicación no debe
 * conocer el framework, y es el filtro del borde HTTP quien lo traduce a 403.
 */
export class ReservationOwnershipError extends DomainError {
  constructor() {
    super('No puede actuar sobre una reserva ajena');
    this.name = 'ReservationOwnershipError';
  }
}

/**
 * La clienta intenta mover una cita cuya hora ya pasó (o que está dentro del
 * margen de antelación configurado). Paridad con `CancellationTooLateError`:
 * un umbral mayor para reprogramar que para cancelar sería esquivable —
 * bastaría cancelar y volver a reservar.
 */
export class RescheduleTooLateError extends DomainError {
  constructor() {
    super('Ya no es posible cambiar la hora de esta reserva');
    this.name = 'RescheduleTooLateError';
  }
}

/** La reserva terminó su ciclo (cumplida o cancelada): no se puede mover. */
export class ReservationNotReschedulableError extends DomainError {
  constructor(status: string) {
    super(`Una reserva ${status} no se puede reprogramar`);
    this.name = 'ReservationNotReschedulableError';
  }
}

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

/**
 * Caso particular del solape: la estilista ocupada es la que **eligió la
 * clienta**, así que no se le puede dar otra. Existe porque los dos rechazos
 * tienen remedios distintos —aquí cabe cambiar de hora **o** reservar sin
 * preferencia; en el genérico (salón lleno) solo cambiar de hora— y un 409 mudo
 * obliga a la clienta a adivinar cuál de los dos es.
 *
 * **Hereda de `WorkerOverlapError` a propósito:** todo lo que ya comprobaba el
 * genérico —el filtro HTTP que lo traduce a 409, el mapeo de motivos del
 * asistente, el texto de WhatsApp— sigue funcionando sin tocar nada, así que
 * ningún camino se queda sin traducción por olvido. **El precio:** allí donde se
 * quieran distinguir, el `instanceof` específico tiene que ir ANTES que el
 * genérico, o el genérico se los come a los dos.
 */
export class ChosenWorkerBusyError extends WorkerOverlapError {
  constructor() {
    super();
    this.message = 'La estilista que elegiste ya tiene una reserva a esa hora';
    this.name = 'ChosenWorkerBusyError';
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

/**
 * Se intentó cambiar la estilista de una reserva cuya estilista **eligió la
 * clienta**. No es un error que un usuario pueda provocar desde fuera —el caso
 * de uso comprueba la marca antes de reasignar—: es la guarda que impide que un
 * adaptador o un caso de uso futuro se salte la invariante por descuido. Que
 * viva en el agregado y no en el caso de uso es deliberado: reasignar a quien sí
 * había elegido estilista falla en silencio y se descubre el día de la cita.
 */
export class WorkerReassignmentNotAllowedError extends DomainError {
  constructor() {
    super('Esta reserva conserva la estilista que eligió la clienta');
    this.name = 'WorkerReassignmentNotAllowedError';
  }
}

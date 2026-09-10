import {
  InvalidReservationError,
  EmptyServicesError,
  MissingContactError,
  CancellationTooLateError,
  RescheduleTooLateError,
  ReservationNotReschedulableError,
} from './errors';
import {
  ReservationStatus,
  assertTransition,
  canReschedule,
} from './reservation-status';
import { ReservationLine } from './reservation-line';
import { ContactInfo } from './contact-info';

export interface ReservationProps {
  id?: string;
  userId?: string | null;
  contact?: ContactInfo | null;
  scheduledAt: Date;
  endedAt: Date;
  workerId: string;
  status: ReservationStatus;
  lines: ReservationLine[];
}

/**
 * Raíz de agregado de Reservas. Encapsula la duración derivada de las líneas,
 * el vínculo opcional a usuario, el contacto de invitado y el ciclo de vida
 * (§6.4). Puro: sin dependencias de framework ni de base de datos.
 */
export class Reservation {
  readonly id?: string;
  readonly userId: string | null;
  readonly contact: ContactInfo | null;
  readonly workerId: string;
  readonly lines: ReservationLine[];
  // La ventana es privada desde que existe la reprogramación: sigue siendo de
  // solo lectura desde fuera (los getters), pero el agregado necesita poder
  // moverla, y que solo él pueda hacerlo.
  private _scheduledAt: Date;
  private _endedAt: Date;
  private _status: ReservationStatus;

  private constructor(props: ReservationProps) {
    this.id = props.id;
    this.userId = props.userId ?? null;
    this.contact = props.contact ?? null;
    this._scheduledAt = props.scheduledAt;
    this._endedAt = props.endedAt;
    this.workerId = props.workerId;
    this.lines = props.lines;
    this._status = props.status;
  }

  get status(): ReservationStatus {
    return this._status;
  }

  get scheduledAt(): Date {
    return this._scheduledAt;
  }

  get endedAt(): Date {
    return this._endedAt;
  }

  /** Duración total derivada de las líneas (nunca se confía en el cliente). */
  get totalDurationMinutes(): number {
    return this.lines.reduce((sum, line) => sum + line.durationMinutes, 0);
  }

  /** Crea una reserva nueva (`pendiente`) calculando el fin de la ventana. */
  static schedule(input: {
    scheduledAt: Date;
    workerId: string;
    lines: ReservationLine[];
    userId?: string | null;
    contact?: ContactInfo | null;
  }): Reservation {
    if (Number.isNaN(input.scheduledAt.getTime())) {
      throw new InvalidReservationError('scheduledAt is invalid');
    }
    if (!input.lines || input.lines.length === 0) {
      throw new EmptyServicesError();
    }
    if (!input.userId && !input.contact) {
      throw new MissingContactError();
    }
    return new Reservation({
      scheduledAt: input.scheduledAt,
      endedAt: endOfWindow(input.scheduledAt, input.lines),
      workerId: input.workerId,
      lines: input.lines,
      userId: input.userId ?? null,
      contact: input.contact ?? null,
      status: ReservationStatus.Pendiente,
    });
  }

  /** Rehidrata una reserva persistida (usado por el mapper de infraestructura). */
  static fromPersistence(props: ReservationProps): Reservation {
    return new Reservation(props);
  }

  /**
   * Forma pública serializada: expone `status` y `totalDurationMinutes` (que son
   * getters) y oculta el campo interno `_status`. La invoca `JSON.stringify`
   * cuando el controlador devuelve el agregado directamente.
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      contact: this.contact,
      scheduledAt: this.scheduledAt,
      endedAt: this.endedAt,
      workerId: this.workerId,
      status: this.status,
      totalDurationMinutes: this.totalDurationMinutes,
      lines: this.lines,
    };
  }

  confirm(): void {
    assertTransition(this._status, ReservationStatus.Confirmada);
    this._status = ReservationStatus.Confirmada;
  }

  markFulfilled(): void {
    assertTransition(this._status, ReservationStatus.Cumplida);
    this._status = ReservationStatus.Cumplida;
  }

  /**
   * Cancelación: el cliente solo puede cancelar antes de la hora de inicio;
   * administración puede cancelar en cualquier momento (salvo estados
   * terminales, que la máquina de estados rechaza).
   */
  cancel(opts: { byAdmin: boolean; now: Date }): void {
    if (!opts.byAdmin && opts.now.getTime() >= this.scheduledAt.getTime()) {
      throw new CancellationTooLateError();
    }
    assertTransition(this._status, ReservationStatus.Cancelada);
    this._status = ReservationStatus.Cancelada;
  }

  /**
   * Mueve la cita en el tiempo. **Conserva el estado y el estilista**: solo
   * cambia la ventana, y el fin se recalcula desde la duración de las líneas
   * (nunca se confía en un `endedAt` de fuera).
   *
   * Por qué conserva el estado: degradar una `confirmada` a `pendiente` la
   * dejaría a merced del cron de saldado, que cancela las pendientes vencidas.
   * Una clienta que movió su cita y sí asistió quedaría registrada como
   * cancelada. Que la peluquería recupere el control de una hora nueva que no le
   * sirve se resuelve avisándole —y dándole con qué actuar—, no corrompiendo el
   * histórico.
   *
   * `minLeadMinutes` es el margen de antelación del autoservicio. Con `0` (el
   * valor por defecto) la regla es idéntica a la de cancelar: hasta el momento
   * de la cita. Se mide contra la hora **actual** de la cita, no la nueva.
   */
  reschedule(opts: {
    scheduledAt: Date;
    now: Date;
    byAdmin: boolean;
    minLeadMinutes?: number;
  }): void {
    if (Number.isNaN(opts.scheduledAt.getTime())) {
      throw new InvalidReservationError('scheduledAt is invalid');
    }
    if (!canReschedule(this._status)) {
      throw new ReservationNotReschedulableError(this._status);
    }
    if (!opts.byAdmin) {
      const lead = (opts.minLeadMinutes ?? 0) * 60 * 1000;
      if (opts.now.getTime() >= this._scheduledAt.getTime() - lead) {
        throw new RescheduleTooLateError();
      }
    }
    this._scheduledAt = opts.scheduledAt;
    this._endedAt = endOfWindow(opts.scheduledAt, this.lines);
  }
}

/**
 * Fin de la ventana derivado de la duración de las líneas. Único sitio donde
 * vive la fórmula: la usan la creación y la reprogramación, y si estuviera
 * duplicada podrían divergir.
 */
function endOfWindow(scheduledAt: Date, lines: ReservationLine[]): Date {
  const total = lines.reduce((sum, l) => sum + l.durationMinutes, 0);
  return new Date(scheduledAt.getTime() + total * 60 * 1000);
}

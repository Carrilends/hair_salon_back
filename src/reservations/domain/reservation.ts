import {
  InvalidReservationError,
  EmptyServicesError,
  MissingContactError,
  CancellationTooLateError,
} from './errors';
import { ReservationStatus, assertTransition } from './reservation-status';
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
  readonly scheduledAt: Date;
  readonly endedAt: Date;
  readonly workerId: string;
  readonly lines: ReservationLine[];
  private _status: ReservationStatus;

  private constructor(props: ReservationProps) {
    this.id = props.id;
    this.userId = props.userId ?? null;
    this.contact = props.contact ?? null;
    this.scheduledAt = props.scheduledAt;
    this.endedAt = props.endedAt;
    this.workerId = props.workerId;
    this.lines = props.lines;
    this._status = props.status;
  }

  get status(): ReservationStatus {
    return this._status;
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
    const total = input.lines.reduce((sum, l) => sum + l.durationMinutes, 0);
    const endedAt = new Date(input.scheduledAt.getTime() + total * 60 * 1000);
    return new Reservation({
      scheduledAt: input.scheduledAt,
      endedAt,
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
}

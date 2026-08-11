import { InvalidReservationError } from './errors';

export interface ReservationProps {
  id?: string;
  scheduledAt: Date;
  endedAt: Date;
  workerId: string;
  totalDurationMinutes: number;
}

export class Reservation {
  readonly id?: string;
  readonly scheduledAt: Date;
  readonly endedAt: Date;
  readonly workerId: string;
  readonly totalDurationMinutes: number;

  private constructor(props: ReservationProps) {
    this.id = props.id;
    this.scheduledAt = props.scheduledAt;
    this.endedAt = props.endedAt;
    this.workerId = props.workerId;
    this.totalDurationMinutes = props.totalDurationMinutes;
  }

  /** Crea una reserva nueva calculando el fin de la ventana. */
  static schedule(input: {
    scheduledAt: Date;
    totalDurationMinutes: number;
    workerId: string;
  }): Reservation {
    if (Number.isNaN(input.scheduledAt.getTime())) {
      throw new InvalidReservationError('scheduledAt is invalid');
    }
    if (
      !Number.isInteger(input.totalDurationMinutes) ||
      input.totalDurationMinutes < 1
    ) {
      throw new InvalidReservationError(
        'totalDurationMinutes must be a positive integer',
      );
    }
    const endedAt = new Date(
      input.scheduledAt.getTime() + input.totalDurationMinutes * 60 * 1000,
    );
    return new Reservation({ ...input, endedAt });
  }

  /** Rehidrata una reserva persistida (usado por el mapper de infraestructura). */
  static fromPersistence(props: ReservationProps): Reservation {
    return new Reservation(props);
  }
}

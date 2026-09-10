import { ReservationActor } from 'src/reservations/domain/reservation-actor';

/** Lo que el canal necesita saber de una cita para hablar de ella. */
export interface ReservationSummary {
  id: string;
  scheduledAt: Date;
  status: string;
  workerId: string;
  workerName: string;
  totalDurationMinutes: number;
  serviceNames: string[];
}

/**
 * Todo lo que el canal de WhatsApp necesita del contexto de Reservas, en su
 * idioma. Un puerto y no una llamada directa a los casos de uso para que el
 * manejador se pueda probar entero —los seis flujos, con sus errores— sin base
 * de datos ni módulo de Nest.
 *
 * Detrás no hay lógica nueva: el adaptador delega en los **mismos** casos de uso
 * que usan el portal y el asistente. Las reglas de propiedad y de plazo se
 * comprueban allí, no aquí.
 */
export interface ReservationActionsPort {
  /** Citas sobre las que ese número puede actuar: suyas, futuras, no terminales. */
  findActionableByPhone(
    phoneE164: string,
    now: Date,
  ): Promise<ReservationSummary[]>;

  findById(id: string): Promise<ReservationSummary | null>;

  cancel(id: string, actor: ReservationActor): Promise<void>;

  reschedule(
    id: string,
    scheduledAtIso: string,
    actor: ReservationActor,
  ): Promise<void>;

  /** Confirmar es de administración; el manejador ya ha comprobado quién pide. */
  confirm(id: string): Promise<void>;

  /**
   * Próximos días con al menos un hueco donde quepa una cita de esa duración
   * con ese estilista. `YYYY-MM-DD` en la zona del salón.
   */
  daysWithAvailability(
    workerId: string,
    durationMinutes: number,
    now: Date,
    max: number,
  ): Promise<string[]>;

  /**
   * Horas `HH:mm` libres ese día para ese estilista y esa duración. No recibe
   * `now`: la disponibilidad del salón ya recorta por su cuenta el tramo del día
   * de hoy que ya pasó.
   */
  slotsFor(
    dateYmd: string,
    workerId: string,
    durationMinutes: number,
  ): Promise<string[]>;
}

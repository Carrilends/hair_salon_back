import {
  ReservationStatus,
  assertTransition,
  canReschedule,
  canTransition,
  isTerminal,
} from './reservation-status';
import { InvalidStatusTransitionError } from './errors';

/**
 * Ciclo de vida de la reserva (fuente de verdad §6.4):
 *   pendiente → confirmada → cumplida, con salida lateral `cancelada`.
 * Reglas puras, sin framework ni base de datos.
 */
describe('máquina de estados de la reserva (§6.4)', () => {
  it('permite pendiente → confirmada', () => {
    expect(() =>
      assertTransition(
        ReservationStatus.Pendiente,
        ReservationStatus.Confirmada,
      ),
    ).not.toThrow();
  });

  it('permite pendiente → cancelada', () => {
    expect(() =>
      assertTransition(
        ReservationStatus.Pendiente,
        ReservationStatus.Cancelada,
      ),
    ).not.toThrow();
  });

  it('permite confirmada → cumplida', () => {
    expect(() =>
      assertTransition(
        ReservationStatus.Confirmada,
        ReservationStatus.Cumplida,
      ),
    ).not.toThrow();
  });

  it('permite confirmada → cancelada', () => {
    expect(() =>
      assertTransition(
        ReservationStatus.Confirmada,
        ReservationStatus.Cancelada,
      ),
    ).not.toThrow();
  });

  it('rechaza salir de un estado terminal (cumplida)', () => {
    expect(() =>
      assertTransition(
        ReservationStatus.Cumplida,
        ReservationStatus.Confirmada,
      ),
    ).toThrow(InvalidStatusTransitionError);
  });

  it('rechaza salir de un estado terminal (cancelada)', () => {
    expect(() =>
      assertTransition(
        ReservationStatus.Cancelada,
        ReservationStatus.Pendiente,
      ),
    ).toThrow(InvalidStatusTransitionError);
  });

  it('canTransition informa la transición sin lanzar', () => {
    expect(
      canTransition(ReservationStatus.Pendiente, ReservationStatus.Confirmada),
    ).toBe(true);
    expect(
      canTransition(ReservationStatus.Cumplida, ReservationStatus.Cancelada),
    ).toBe(false);
  });
});

describe('isTerminal / canReschedule', () => {
  it('cumplida y cancelada son terminales', () => {
    expect(isTerminal(ReservationStatus.Cumplida)).toBe(true);
    expect(isTerminal(ReservationStatus.Cancelada)).toBe(true);
  });

  it('pendiente y confirmada no son terminales', () => {
    expect(isTerminal(ReservationStatus.Pendiente)).toBe(false);
    expect(isTerminal(ReservationStatus.Confirmada)).toBe(false);
  });

  it('se puede reprogramar lo que no ha terminado', () => {
    // Reprogramar NO es una transición de estado: mueve la ventana y conserva el
    // estado. Por eso necesita su propio predicado y no puede apoyarse en
    // `canTransition`, que rechazaría la auto-transición pendiente→pendiente.
    expect(canReschedule(ReservationStatus.Pendiente)).toBe(true);
    expect(canReschedule(ReservationStatus.Confirmada)).toBe(true);
    expect(canReschedule(ReservationStatus.Cumplida)).toBe(false);
    expect(canReschedule(ReservationStatus.Cancelada)).toBe(false);
  });

  it('canTransition rechaza la auto-transición, que es justo por lo que existe canReschedule', () => {
    expect(
      canTransition(ReservationStatus.Pendiente, ReservationStatus.Pendiente),
    ).toBe(false);
  });
});

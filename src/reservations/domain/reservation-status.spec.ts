import {
  ReservationStatus,
  assertTransition,
  canTransition,
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

import { DailyTokenLedger } from './daily-token-ledger';

const RESERVA = 2000;

describe('DailyTokenLedger', () => {
  it('sin sembrar no autoriza nada: falla cerrado', () => {
    const libro = new DailyTokenLedger(RESERVA);
    expect(libro.reservar('2026-09-29', 200_000)).toBe(false);
  });

  it('sembrado y con margen, autoriza', () => {
    const libro = new DailyTokenLedger(RESERVA);
    libro.sembrar('2026-09-29', 1_000);
    expect(libro.reservar('2026-09-29', 200_000)).toBe(true);
  });

  it('alcanzado el techo, deja de autorizar', () => {
    const libro = new DailyTokenLedger(RESERVA);
    libro.sembrar('2026-09-29', 200_000);
    expect(libro.reservar('2026-09-29', 200_000)).toBe(false);
  });

  describe('la reserva cierra la carrera entre turnos simultáneos', () => {
    // El defecto que esto arregla: el gasto solo se escribía en la base al
    // TERMINAR un turno, así que N peticiones a la vez leían todas la misma
    // cifra por debajo del techo y las N llamaban al modelo. Reservando por
    // adelantado, la segunda ya ve ocupado lo que la primera va a gastar.
    it('dos turnos seguidos sin liquidar no comparten el mismo hueco', () => {
      const libro = new DailyTokenLedger(RESERVA);
      libro.sembrar('2026-09-29', 199_000);

      expect(libro.reservar('2026-09-29', 200_000)).toBe(true);
      expect(libro.reservar('2026-09-29', 200_000)).toBe(false);
    });

    it('liquidar devuelve el sobrante de la reserva', () => {
      const libro = new DailyTokenLedger(RESERVA);
      libro.sembrar('2026-09-29', 0);

      libro.reservar('2026-09-29', 200_000);
      expect(libro.gastoConocido).toBe(RESERVA);

      libro.liquidar('2026-09-29', 300);
      expect(libro.gastoConocido).toBe(300);
    });

    it('un turno más caro que la reserva se cobra por lo que costó', () => {
      const libro = new DailyTokenLedger(RESERVA);
      libro.sembrar('2026-09-29', 0);

      libro.reservar('2026-09-29', 200_000);
      libro.liquidar('2026-09-29', 9_000);

      expect(libro.gastoConocido).toBe(9_000);
    });

    it('un turno que no llegó a gastar nada no deja rastro', () => {
      const libro = new DailyTokenLedger(RESERVA);
      libro.sembrar('2026-09-29', 500);

      libro.reservar('2026-09-29', 200_000);
      libro.liquidar('2026-09-29', 0);

      expect(libro.gastoConocido).toBe(500);
    });
  });

  describe('cambio de día', () => {
    it('al cambiar el día hay que volver a sembrar', () => {
      const libro = new DailyTokenLedger(RESERVA);
      libro.sembrar('2026-09-29', 1_000);

      expect(libro.necesitaSiembra('2026-09-29')).toBe(false);
      expect(libro.necesitaSiembra('2026-09-30')).toBe(true);
      expect(libro.reservar('2026-09-30', 200_000)).toBe(false);
    });

    it('sembrar el día nuevo reinicia el gasto conocido', () => {
      const libro = new DailyTokenLedger(RESERVA);
      libro.sembrar('2026-09-29', 199_000);
      libro.sembrar('2026-09-30', 0);

      expect(libro.gastoConocido).toBe(0);
      expect(libro.reservar('2026-09-30', 200_000)).toBe(true);
    });

    it('liquidar un turno que empezó ayer no toca el día de hoy', () => {
      const libro = new DailyTokenLedger(RESERVA);
      libro.sembrar('2026-09-29', 0);
      libro.reservar('2026-09-29', 200_000);
      libro.sembrar('2026-09-30', 0);

      libro.liquidar('2026-09-29', 5_000);

      expect(libro.gastoConocido).toBe(0);
    });
  });

  it('sembrar dos veces el mismo día no borra lo ya reservado', () => {
    // Dos peticiones en frío consultan la base a la vez; la segunda llega con
    // su lectura cuando la primera ya apartó su reserva.
    const libro = new DailyTokenLedger(RESERVA);
    libro.sembrar('2026-09-29', 199_000);
    libro.reservar('2026-09-29', 200_000);

    libro.sembrar('2026-09-29', 199_000);

    expect(libro.gastoConocido).toBe(199_000 + RESERVA);
    expect(libro.reservar('2026-09-29', 200_000)).toBe(false);
  });

  it('una siembra negativa se trata como cero', () => {
    const libro = new DailyTokenLedger(RESERVA);
    libro.sembrar('2026-09-29', -10);
    expect(libro.gastoConocido).toBe(0);
  });
});

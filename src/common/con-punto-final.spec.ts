import { conPuntoFinal } from './con-punto-final';

/**
 * Una hora en 12 horas termina en «a. m.» o «p. m.»: si la frase le añade su
 * punto final, se lee «a. m..» (prueba con móvil del 2026-11-10).
 */
describe('conPuntoFinal', () => {
  it('añade el punto a una frase que no lo tiene', () => {
    expect(conPuntoFinal('Tu cita quedó el lunes')).toBe(
      'Tu cita quedó el lunes.',
    );
  });

  it('no duplica el punto de «a. m.» ni de «p. m.»', () => {
    expect(conPuntoFinal('a las 8:00 a. m.')).toBe('a las 8:00 a. m.');
    expect(conPuntoFinal('a las 3:30 p. m.')).toBe('a las 3:30 p. m.');
  });

  it('tampoco con el espacio duro que pone Intl («a. m.»)', () => {
    expect(conPuntoFinal('10:00 a. m.')).toBe('10:00 a. m.');
  });

  it('respeta otros cierres de frase', () => {
    expect(conPuntoFinal('¿Sigue en pie?')).toBe('¿Sigue en pie?');
    expect(conPuntoFinal('¡Listo!')).toBe('¡Listo!');
  });
});

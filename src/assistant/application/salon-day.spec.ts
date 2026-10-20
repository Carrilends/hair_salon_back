import { fechaYHoraEnPalabras, instanteDelSalon } from './salon-day';

describe('fechaYHoraEnPalabras', () => {
  it('dice el día y la hora del salón como se dirían en voz alta', () => {
    // 2026-10-02T20:00:00Z son las 15:00 del viernes en Bogotá (UTC-5).
    const { fecha, hora } = fechaYHoraEnPalabras('2026-10-02T20:00:00.000Z');

    expect(fecha).toContain('viernes');
    expect(fecha).toContain('octubre');
    expect(fecha).toContain('2026');
    expect(fecha).toContain('2');
    expect(hora).toBe('15:00');
  });

  it('usa la zona del salón, no la del servidor', () => {
    // 2026-10-03T02:00:00Z ya es sábado 3 en UTC, pero en Bogotá son las 21:00
    // del viernes 2. Un juicio que comparase el día equivocado con lo que pidió
    // la clienta frenaría reservas correctas.
    const { fecha, hora } = fechaYHoraEnPalabras('2026-10-03T02:00:00.000Z');

    expect(fecha).toContain('viernes');
    expect(hora).toBe('21:00');
  });

  it('una fecha ilegible no revienta: devuelve cadenas vacías', () => {
    // Fail-open hasta en el formateo: quien pregunta se queda sin juicio, no
    // sin turno.
    expect(fechaYHoraEnPalabras('no es una fecha')).toEqual({
      fecha: '',
      hora: '',
    });
  });
});

describe('instanteDelSalon', () => {
  // La suite corre en UTC (`test/jest-zona-utc.js`): un `new Date` sobre una
  // hora sin zona daría las 08:00 UTC, las 03:00 en el salón, que es el fallo
  // visto en la prueba con móvil.
  it('una hora sin zona es hora del salón, no la del servidor', () => {
    expect(instanteDelSalon('2026-10-23T08:00:00')?.toISOString()).toBe(
      '2026-10-23T13:00:00.000Z',
    );
  });

  it('acepta la hora sin segundos', () => {
    expect(instanteDelSalon('2026-10-23T08:00')?.toISOString()).toBe(
      '2026-10-23T13:00:00.000Z',
    );
  });

  it('respeta la zona cuando viene escrita', () => {
    expect(instanteDelSalon('2026-10-23T08:00:00-05:00')?.toISOString()).toBe(
      '2026-10-23T13:00:00.000Z',
    );
    expect(instanteDelSalon('2026-10-23T13:00:00Z')?.toISOString()).toBe(
      '2026-10-23T13:00:00.000Z',
    );
  });

  it('una fecha ilegible da null', () => {
    expect(instanteDelSalon('el viernes')).toBeNull();
    expect(instanteDelSalon('2026-10-23T25:00')).toBeNull();
  });
});

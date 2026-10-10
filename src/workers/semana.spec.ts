import { capacidadDelDia, diasDeLaSemana, lunesDeLaSemana } from './semana';

/**
 * La semana del panel de estilistas va de lunes a domingo, en fechas civiles
 * del salón. Lo delicado es el domingo (pertenece a la semana que EMPIEZA el
 * lunes anterior, no a la siguiente) y los cruces de mes, de año y de febrero
 * bisiesto.
 */
describe('lunesDeLaSemana', () => {
  it('un lunes es su propio lunes', () => {
    expect(lunesDeLaSemana('2026-10-05')).toBe('2026-10-05');
  });

  it('un miércoles vuelve al lunes de su semana', () => {
    expect(lunesDeLaSemana('2026-10-07')).toBe('2026-10-05');
  });

  it('un domingo vuelve al lunes ANTERIOR, no avanza al siguiente', () => {
    expect(lunesDeLaSemana('2026-10-11')).toBe('2026-10-05');
  });

  it('cruza el año hacia atrás', () => {
    // 2026-01-01 es jueves.
    expect(lunesDeLaSemana('2026-01-01')).toBe('2025-12-29');
  });

  it('cruza un febrero bisiesto', () => {
    // 2024-03-01 es viernes.
    expect(lunesDeLaSemana('2024-03-01')).toBe('2024-02-26');
  });
});

describe('diasDeLaSemana', () => {
  it('da los siete días, de lunes a domingo, con el 29 de febrero', () => {
    expect(diasDeLaSemana('2024-02-26')).toEqual([
      '2024-02-26',
      '2024-02-27',
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
      '2024-03-02',
      '2024-03-03',
    ]);
  });
});

describe('capacidadDelDia', () => {
  it('entre semana son 12 h (8:00–20:00)', () => {
    expect(capacidadDelDia('2026-10-13')).toBe(720);
  });

  it('el sábado son 10 h (9:00–19:00)', () => {
    expect(capacidadDelDia('2026-10-17')).toBe(600);
  });

  it('un lunes festivo tiene el horario reducido, no el de entre semana', () => {
    // Día de la Raza: 12 de octubre de 2026, lunes.
    expect(capacidadDelDia('2026-10-12')).toBe(600);
  });
});

import { parseDurationSeconds } from './parse-duration-seconds';

describe('parseDurationSeconds', () => {
  it('interpreta segundos, minutos, horas y días', () => {
    expect(parseDurationSeconds('45s')).toBe(45);
    expect(parseDurationSeconds('15m')).toBe(900);
    expect(parseDurationSeconds('1h')).toBe(3600);
    expect(parseDurationSeconds('30d')).toBe(30 * 24 * 60 * 60);
  });

  it('un número sin sufijo se interpreta como segundos', () => {
    expect(parseDurationSeconds('900')).toBe(900);
  });

  it('rechaza un formato inválido', () => {
    expect(() => parseDurationSeconds('quince minutos')).toThrow();
  });
});

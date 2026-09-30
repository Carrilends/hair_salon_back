import { percentil } from './banco-jev';

describe('percentil', () => {
  it('no devuelve el máximo cuando la muestra es pequeña', () => {
    // El defecto que tenía: `ceil(0.95·n)-1` apunta al último elemento para
    // cualquier n <= 20, así que el «p95» de 18 medidas era «la peor de 18».
    // Es un número que va a la tesis, así que no puede llamarse p95.
    const muestra = [100, 110, 120, 130, 140, 150, 160, 170, 180, 900];

    expect(percentil(muestra, 95)).toBeLessThan(900);
  });

  it('interpola entre los dos vecinos', () => {
    expect(percentil([10, 20], 50)).toBe(15);
    expect(percentil([0, 100], 25)).toBe(25);
  });

  it('en los extremos da el mínimo y el máximo', () => {
    const muestra = [1, 2, 3, 4];

    expect(percentil(muestra, 0)).toBe(1);
    expect(percentil(muestra, 100)).toBe(4);
  });

  it('con un solo valor, ese valor', () => {
    expect(percentil([7], 95)).toBe(7);
  });

  it('sin muestra, cero', () => {
    expect(percentil([], 95)).toBe(0);
  });
});

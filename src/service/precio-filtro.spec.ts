import { PESOS_POR_UNIDAD_DE_FILTRO, rangoEnPesos } from './precio-filtro';

/**
 * El control de precio del portal trabaja en MILES de pesos (5 … 200) y los
 * precios del catálogo están en pesos (15.000 … 250.000). Comparar uno contra
 * otro sin convertir dejaba el filtro siempre vacío.
 */
describe('rangoEnPesos', () => {
  it('convierte el rango del control, en miles, a pesos', () => {
    expect(PESOS_POR_UNIDAD_DE_FILTRO).toBe(1000);
    expect(rangoEnPesos({ min: 30, max: 100 })).toEqual({
      min: 30000,
      max: 100000,
    });
  });

  it('los extremos del control cubren precios reales del catálogo', () => {
    const { min, max } = rangoEnPesos({ min: 5, max: 200 });
    expect(min).toBeLessThanOrEqual(15000);
    expect(max).toBeGreaterThanOrEqual(150000);
  });

  it('un mínimo por encima del máximo se ordena en vez de dar un BETWEEN vacío', () => {
    expect(rangoEnPesos({ min: 120, max: 40 })).toEqual({
      min: 40000,
      max: 120000,
    });
  });

  it('acepta valores que llegan como texto numérico', () => {
    expect(
      rangoEnPesos({
        min: '30' as unknown as number,
        max: '60' as unknown as number,
      }),
    ).toEqual({ min: 30000, max: 60000 });
  });
});

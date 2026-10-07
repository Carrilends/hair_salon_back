import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FilterServiceDto } from './filter-service.dto';

/**
 * Mismas opciones que la `ValidationPipe` global de `main.ts`: lo que no esté
 * decorado se rechaza. `prices` antes no se validaba en absoluto.
 */
const validar = (cuerpo: object) =>
  validate(plainToInstance(FilterServiceDto, cuerpo), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('FilterServiceDto · prices', () => {
  it('admite el rango que manda el portal', async () => {
    expect(
      await validar({ includePriceRange: true, prices: { min: 5, max: 200 } }),
    ).toHaveLength(0);
  });

  it('admite que no venga rango, o que venga nulo', async () => {
    expect(await validar({})).toHaveLength(0);
    expect(await validar({ prices: null })).toHaveLength(0);
  });

  it('rechaza un rango con valores que no son números', async () => {
    const errores = await validar({ prices: { min: 'mucho', max: 200 } });
    expect(errores.map((e) => e.property)).toContain('prices');
  });

  it('rechaza un rango negativo', async () => {
    const errores = await validar({ prices: { min: -5, max: 200 } });
    expect(errores.map((e) => e.property)).toContain('prices');
  });

  it('rechaza campos de más dentro del rango', async () => {
    const errores = await validar({
      prices: { min: 5, max: 200, moneda: 'USD' },
    });
    expect(errores.map((e) => e.property)).toContain('prices');
  });
});

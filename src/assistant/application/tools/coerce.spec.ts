import { coerceOptionalNumber } from './coerce';

describe('coerceOptionalNumber', () => {
  it('devuelve el número tal cual', () => {
    expect(coerceOptionalNumber(200000)).toBe(200000);
    expect(coerceOptionalNumber(0)).toBe(0);
  });

  it('coacciona una cadena numérica (los LLM a veces la mandan así)', () => {
    expect(coerceOptionalNumber('200000')).toBe(200000);
    expect(coerceOptionalNumber('  150000 ')).toBe(150000);
  });

  it('devuelve undefined para valores no numéricos o vacíos', () => {
    expect(coerceOptionalNumber(undefined)).toBeUndefined();
    expect(coerceOptionalNumber('')).toBeUndefined();
    expect(coerceOptionalNumber('  ')).toBeUndefined();
    expect(coerceOptionalNumber('mucho')).toBeUndefined();
    expect(coerceOptionalNumber(null)).toBeUndefined();
    expect(coerceOptionalNumber(NaN)).toBeUndefined();
    expect(coerceOptionalNumber(Infinity)).toBeUndefined();
  });
});

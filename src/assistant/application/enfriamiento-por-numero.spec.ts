import { EnfriamientoPorNumero } from './enfriamiento-por-numero';

const SEIS_H = 6 * 60 * 60 * 1000;
const T0 = new Date('2026-10-14T15:00:00Z');
const despues = (ms: number) => new Date(T0.getTime() + ms);

describe('EnfriamientoPorNumero (plan 06, F6, D8)', () => {
  it('un número sin avisos previos puede', () => {
    expect(new EnfriamientoPorNumero(SEIS_H).puede('573001112233', T0)).toBe(
      true,
    );
  });

  it('tras anotar, no puede hasta que pasa la ventana', () => {
    const e = new EnfriamientoPorNumero(SEIS_H);
    e.anotar('573001112233', T0);
    expect(e.puede('573001112233', despues(SEIS_H - 1))).toBe(false);
    expect(e.puede('573001112233', despues(SEIS_H))).toBe(true);
  });

  it('cada número lleva su cuenta', () => {
    const e = new EnfriamientoPorNumero(SEIS_H);
    e.anotar('573001112233', T0);
    expect(e.puede('573009998877', T0)).toBe(true);
  });

  it('consultar no anota', () => {
    const e = new EnfriamientoPorNumero(SEIS_H);
    e.puede('573001112233', T0);
    expect(e.puede('573001112233', T0)).toBe(true);
  });
});

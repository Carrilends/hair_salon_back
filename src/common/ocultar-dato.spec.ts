import { ocultarCorreo, ocultarTelefono } from './ocultar-dato';

describe('ocultarCorreo', () => {
  it('deja la primera letra y el dominio', () => {
    expect(ocultarCorreo('lucia.perez@gmail.com')).toBe('l***@gmail.com');
  });

  it('no revela nada de un valor sin arroba', () => {
    expect(ocultarCorreo('sin-arroba')).toBe('***');
  });

  it('acepta vacío o nulo', () => {
    expect(ocultarCorreo('')).toBe('***');
    expect(ocultarCorreo(null)).toBe('***');
    expect(ocultarCorreo(undefined)).toBe('***');
  });
});

describe('ocultarTelefono', () => {
  it('deja solo los cuatro últimos dígitos', () => {
    expect(ocultarTelefono('573118558210')).toBe('…8210');
    expect(ocultarTelefono('+57 311 855 8210')).toBe('…8210');
  });

  it('no revela un número demasiado corto', () => {
    expect(ocultarTelefono('123')).toBe('…');
  });

  it('acepta vacío o nulo', () => {
    expect(ocultarTelefono('')).toBe('…');
    expect(ocultarTelefono(null)).toBe('…');
    expect(ocultarTelefono(undefined)).toBe('…');
  });
});

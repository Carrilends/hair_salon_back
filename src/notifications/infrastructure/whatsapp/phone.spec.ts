import { normalizeCoPhoneToE164 } from './phone';

/**
 * Normalización pura a E.164 (Colombia) para el destinatario de WhatsApp. Los
 * teléfonos se guardan sin normalizar (solo `trim`), así que pueden llegar como
 * `3001234567`, `+57 300 123 4567`, con guiones, con `57` ya puesto, etc. La
 * Cloud API exige solo dígitos con indicativo de país (`57` + 10 dígitos). Un
 * número que no encaje devuelve `null` para que el canal se salte el envío.
 */
describe('normalizeCoPhoneToE164', () => {
  it('antepone 57 a un móvil local de 10 dígitos', () => {
    expect(normalizeCoPhoneToE164('3001234567')).toBe('573001234567');
  });

  it('deja igual un número que ya trae el indicativo 57', () => {
    expect(normalizeCoPhoneToE164('573001234567')).toBe('573001234567');
  });

  it('quita el + y los espacios de un número con indicativo', () => {
    expect(normalizeCoPhoneToE164('+57 300 123 4567')).toBe('573001234567');
  });

  it('quita guiones y paréntesis de un número local', () => {
    expect(normalizeCoPhoneToE164('(300) 123-4567')).toBe('573001234567');
  });

  it('quita un cero de troncal inicial', () => {
    expect(normalizeCoPhoneToE164('03001234567')).toBe('573001234567');
  });

  it('combina quitar el cero de troncal y conservar el indicativo 57', () => {
    expect(normalizeCoPhoneToE164('0573001234567')).toBe('573001234567');
  });

  it('devuelve null para entrada null', () => {
    expect(normalizeCoPhoneToE164(null)).toBeNull();
  });

  it('devuelve null para cadena vacía o solo espacios', () => {
    expect(normalizeCoPhoneToE164('')).toBeNull();
    expect(normalizeCoPhoneToE164('   ')).toBeNull();
  });

  it('devuelve null para un número demasiado corto', () => {
    expect(normalizeCoPhoneToE164('12345')).toBeNull();
  });

  it('devuelve null cuando no hay dígitos', () => {
    expect(normalizeCoPhoneToE164('sin número')).toBeNull();
  });

  it('devuelve null para un fijo de 10 dígitos que no empieza por 3', () => {
    expect(normalizeCoPhoneToE164('6011234567')).toBeNull();
  });

  it('devuelve null para un móvil con más de 10 dígitos', () => {
    expect(normalizeCoPhoneToE164('3001234567123')).toBeNull();
  });

  it('devuelve null si tras el 57 el local no es un móvil válido', () => {
    expect(normalizeCoPhoneToE164('576011234567')).toBeNull();
  });
});

import { Email } from './email';
import { InvalidEmailError } from './errors';

describe('Email (value object)', () => {
  it('normaliza a minúsculas y recorta espacios', () => {
    expect(Email.create('  Marlene@Correo.COM ').value).toBe(
      'marlene@correo.com',
    );
  });
  it('rechaza valores sin forma de correo', () => {
    expect(() => Email.create('marlene')).toThrow(InvalidEmailError);
    expect(() => Email.create('')).toThrow(InvalidEmailError);
  });
  it('compara por valor normalizado', () => {
    expect(Email.create('A@b.com').equals(Email.create('a@B.COM'))).toBe(true);
  });
});

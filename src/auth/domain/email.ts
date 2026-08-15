import { InvalidEmailError } from './errors';

// Validación deliberadamente conservadora: el borde HTTP ya aplica @IsEmail de
// class-validator. Aquí solo se garantiza el invariante del dominio.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const normalized = (raw ?? '').toLowerCase().trim();
    if (!EMAIL_RE.test(normalized)) throw new InvalidEmailError(raw);
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

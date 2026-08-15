export interface GeneratedToken {
  /** Valor en claro: viaja solo dentro del enlace del correo. */
  raw: string;
  /** Lo único que se persiste. */
  hash: string;
}

export interface SecureTokenGeneratorPort {
  generate(): GeneratedToken;
  hash(raw: string): string;
}

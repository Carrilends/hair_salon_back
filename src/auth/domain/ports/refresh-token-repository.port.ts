import { RefreshToken } from '../refresh-token';

export interface RefreshTokenRepositoryPort {
  save(token: RefreshToken): Promise<RefreshToken>;
  findByHash(tokenHash: string): Promise<RefreshToken | null>;
  /** Rotación: persiste el consumido y el sucesor en una sola transacción. */
  saveRotation(
    consumed: RefreshToken,
    issued: RefreshToken,
  ): Promise<RefreshToken>;
  /** Detección de reuso: corta la sesión entera. */
  revokeFamily(familyId: string, now: Date): Promise<number>;
  /** Cierre de sesión en todos los dispositivos y tras restablecer la contraseña. */
  revokeAllOfUser(userId: string, now: Date): Promise<number>;
}

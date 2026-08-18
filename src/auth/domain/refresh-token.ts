import { InvalidRefreshTokenError, RefreshTokenReuseDetectedError } from './errors';

export interface RefreshTokenProps {
  id?: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByHash: string | null;
  createdAt?: Date;
}

export class RefreshToken {
  readonly id?: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  private _revokedAt: Date | null;
  private _replacedByHash: string | null;
  readonly createdAt?: Date;

  private constructor(props: RefreshTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.familyId = props.familyId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this._revokedAt = props.revokedAt;
    this._replacedByHash = props.replacedByHash;
    this.createdAt = props.createdAt;
  }

  get revokedAt(): Date | null {
    return this._revokedAt;
  }
  get replacedByHash(): string | null {
    return this._replacedByHash;
  }
  get isRevoked(): boolean {
    return this._revokedAt !== null;
  }

  /** Abre una sesión nueva: familia nueva. */
  static issue(input: {
    userId: string;
    tokenHash: string;
    now: Date;
    ttlDays: number;
    familyId?: string;
  }): RefreshToken {
    return new RefreshToken({
      userId: input.userId,
      // El identificador de familia lo provee el borde (adaptador de UUID) o se
      // deriva del propio hash: el dominio no genera aleatoriedad.
      familyId: input.familyId ?? input.tokenHash,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.now.getTime() + input.ttlDays * 24 * 60 * 60 * 1000),
      revokedAt: null,
      replacedByHash: null,
    });
  }

  static fromPersistence(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken(props);
  }

  assertUsable(now: Date): void {
    if (this._replacedByHash !== null) throw new RefreshTokenReuseDetectedError();
    if (this.isRevoked) throw new InvalidRefreshTokenError();
    if (now.getTime() >= this.expiresAt.getTime()) throw new InvalidRefreshTokenError();
  }

  /**
   * Consume este token y devuelve su sucesor en la misma familia. La expiración
   * NO se renueva: la sesión dura 30 días desde que se abrió, no 30 días desde
   * la última actividad. ### (Si se prefiere expiración deslizante, cambiar aquí
   * y documentarlo; alarga la ventana de un robo no detectado.)
   */
  rotate(input: { tokenHash: string; now: Date }): RefreshToken {
    this.assertUsable(input.now);
    this._revokedAt = input.now;
    this._replacedByHash = input.tokenHash;
    return new RefreshToken({
      userId: this.userId,
      familyId: this.familyId,
      tokenHash: input.tokenHash,
      expiresAt: this.expiresAt,
      revokedAt: null,
      replacedByHash: null,
    });
  }

  /** Cierre de sesión: revocación limpia, sin sucesor (no es reuso). */
  revoke(now: Date): void {
    if (this.isRevoked) return;
    this._revokedAt = now;
  }
}

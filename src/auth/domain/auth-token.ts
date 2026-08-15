import { AuthTokenType } from './auth-token-type';
import { AuthTokenAlreadyUsedError, ExpiredAuthTokenError } from './errors';

export interface AuthTokenProps {
  id?: string;
  userId: string;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt?: Date;
}

export class AuthToken {
  readonly id?: string;
  readonly userId: string;
  readonly type: AuthTokenType;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  private _usedAt: Date | null;
  readonly createdAt?: Date;

  private constructor(props: AuthTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.type = props.type;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this._usedAt = props.usedAt;
    this.createdAt = props.createdAt;
  }

  get usedAt(): Date | null {
    return this._usedAt;
  }

  static issue(input: {
    userId: string;
    type: AuthTokenType;
    tokenHash: string;
    now: Date;
    ttlMinutes: number;
  }): AuthToken {
    return new AuthToken({
      userId: input.userId,
      type: input.type,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.now.getTime() + input.ttlMinutes * 60 * 1000),
      usedAt: null,
    });
  }

  static fromPersistence(props: AuthTokenProps): AuthToken {
    return new AuthToken(props);
  }

  assertUsable(now: Date): void {
    if (this._usedAt) throw new AuthTokenAlreadyUsedError();
    if (now.getTime() >= this.expiresAt.getTime())
      throw new ExpiredAuthTokenError();
  }

  markUsed(now: Date): void {
    this.assertUsable(now);
    this._usedAt = now;
  }
}

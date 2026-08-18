import { Email } from './email';
import {
  EmailAlreadyVerifiedError,
  InactiveUserError,
  SameEmailError,
} from './errors';

export interface UserAccountProps {
  id?: string;
  email: Email;
  // S8: las cuentas creadas con Google no tienen contraseña local.
  passwordHash: string | null;
  fullName: string;
  roles: string[];
  isActive: boolean;
  emailVerifiedAt: Date | null;
  dataPolicyAcceptedAt: Date | null;
  googleId?: string | null;
}

export class UserAccount {
  readonly id?: string;
  private _email: Email;
  private _passwordHash: string | null;
  private _fullName: string;
  readonly roles: string[];
  readonly isActive: boolean;
  private _emailVerifiedAt: Date | null;
  readonly dataPolicyAcceptedAt: Date | null;
  private _googleId: string | null;

  private constructor(props: UserAccountProps) {
    this.id = props.id;
    this._email = props.email;
    this._passwordHash = props.passwordHash;
    this._fullName = props.fullName;
    this.roles = props.roles;
    this.isActive = props.isActive;
    this._emailVerifiedAt = props.emailVerifiedAt;
    this.dataPolicyAcceptedAt = props.dataPolicyAcceptedAt;
    this._googleId = props.googleId ?? null;
  }

  get email(): Email {
    return this._email;
  }
  get passwordHash(): string | null {
    return this._passwordHash;
  }
  get googleId(): string | null {
    return this._googleId;
  }
  get fullName(): string {
    return this._fullName;
  }
  get emailVerifiedAt(): Date | null {
    return this._emailVerifiedAt;
  }
  get isEmailVerified(): boolean {
    return this._emailVerifiedAt !== null;
  }

  static register(input: {
    email: Email;
    passwordHash: string;
    fullName: string;
    dataPolicyAccepted: boolean;
    now: Date;
  }): UserAccount {
    return new UserAccount({
      email: input.email,
      passwordHash: input.passwordHash,
      fullName: input.fullName.trim(),
      roles: ['user'],
      isActive: true,
      emailVerifiedAt: null,
      // Evidencia auditable exigida por la Ley 1581 de 2012 (ver Fase 0 T6).
      dataPolicyAcceptedAt: input.dataPolicyAccepted ? input.now : null,
    });
  }

  /**
   * Alta con Google (S3/S8/S9): sin contraseña local, con el correo ya
   * verificado por Google y el consentimiento de la Ley 1581 registrado en el
   * mismo instante (el borde exige el consentimiento antes de llegar aquí).
   */
  static registerWithGoogle(input: {
    email: Email;
    googleId: string;
    fullName: string;
    now: Date;
  }): UserAccount {
    return new UserAccount({
      email: input.email,
      passwordHash: null,
      fullName: input.fullName.trim(),
      roles: ['user'],
      isActive: true,
      emailVerifiedAt: input.now,
      dataPolicyAcceptedAt: input.now,
      googleId: input.googleId,
    });
  }

  static fromPersistence(props: UserAccountProps): UserAccount {
    return new UserAccount(props);
  }

  assertCanAuthenticate(): void {
    if (!this.isActive) throw new InactiveUserError();
  }

  /**
   * Vincula una cuenta local existente con Google (RF52). Como Google entrega el
   * correo ya verificado, la vinculación también da por verificado el correo si
   * aún no lo estaba.
   */
  linkGoogleAccount(googleId: string, now: Date): void {
    this._googleId = googleId;
    if (!this.isEmailVerified) this._emailVerifiedAt = now;
  }

  verifyEmail(now: Date): void {
    if (this.isEmailVerified) throw new EmailAlreadyVerifiedError();
    this._emailVerifiedAt = now;
  }

  rename(fullName: string): void {
    this._fullName = fullName.trim();
  }

  /** E5: cambiar el correo invalida la verificación previa. */
  changeEmail(next: Email): void {
    if (this._email.equals(next)) throw new SameEmailError();
    this._email = next;
    this._emailVerifiedAt = null;
  }

  changePasswordHash(hash: string): void {
    this._passwordHash = hash;
  }
}

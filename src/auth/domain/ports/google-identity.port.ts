export interface GoogleProfile {
  googleId: string; // el `sub` del ID token
  email: string;
  emailVerified: boolean;
  fullName: string;
}

export interface GoogleIdentityPort {
  /** Verifica firma, emisor, audiencia y vigencia. Lanza si el token no es válido. */
  verifyIdToken(idToken: string): Promise<GoogleProfile>;
}

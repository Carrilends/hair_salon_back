export interface IssuedRefresh {
  /** Valor en claro: solo viaja dentro de la cookie. */
  raw: string;
  hash: string;
  familyId: string;
}

export interface TokenIssuerPort {
  issueAccessToken(payload: { id: string }): string;
  /** Vigencia del access token en segundos; la usa el cliente para renovar antes de tiempo. */
  accessTokenTtlSeconds(): number;
  issueRefreshToken(): IssuedRefresh;
  hashRefreshToken(raw: string): string;
}

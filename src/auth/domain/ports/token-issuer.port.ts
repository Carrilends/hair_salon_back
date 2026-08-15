/** La Fase 3b extiende este puerto con la emisión y rotación del refresh token. */
export interface TokenIssuerPort {
  issueAccessToken(payload: { id: string }): string;
}

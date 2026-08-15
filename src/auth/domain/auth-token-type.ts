export enum AuthTokenType {
  PasswordReset = 'password_reset',
  EmailVerification = 'email_verification',
}

/** Vigencia por tipo. ### Umbrales propuestos, confirmables con el tutor. */
export const TOKEN_TTL_MINUTES: Record<AuthTokenType, number> = {
  [AuthTokenType.PasswordReset]: 30,
  [AuthTokenType.EmailVerification]: 60 * 24,
};

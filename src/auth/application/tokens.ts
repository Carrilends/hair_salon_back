export const USER_REPOSITORY = Symbol('UserRepositoryPort');
export const AUTH_TOKEN_REPOSITORY = Symbol('AuthTokenRepositoryPort');
export const PASSWORD_HASHER = Symbol('PasswordHasherPort');
export const TOKEN_ISSUER = Symbol('TokenIssuerPort');
export const SECURE_TOKEN_GENERATOR = Symbol('SecureTokenGeneratorPort');
// EMAIL_SENDER vive ahora en el módulo compartido de notificaciones (Fase 4,
// N6): Auth es uno de sus consumidores. Se re-exporta para no tocar los casos
// de uso que ya lo importaban desde aquí.
export { EMAIL_SENDER } from 'src/notifications/application/tokens';
export const REVIEW_AUTHOR_RENAMER = Symbol('ReviewAuthorRenamerPort');
export const AUTH_CLOCK = Symbol('ClockPort');
export const FRONT_BASE_URL = Symbol('FrontBaseUrl');

// Fase 3b — sesión con refresh rotativo e identidad de Google.
export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepositoryPort');
export const GOOGLE_IDENTITY = Symbol('GoogleIdentityPort');
export const SESSION_CONFIG = Symbol('SessionConfig'); // vigencias y opciones de cookie

export const USER_REPOSITORY = Symbol('UserRepositoryPort');
export const AUTH_TOKEN_REPOSITORY = Symbol('AuthTokenRepositoryPort');
export const PASSWORD_HASHER = Symbol('PasswordHasherPort');
export const TOKEN_ISSUER = Symbol('TokenIssuerPort');
export const SECURE_TOKEN_GENERATOR = Symbol('SecureTokenGeneratorPort');
export const EMAIL_SENDER = Symbol('EmailSenderPort');
export const REVIEW_AUTHOR_RENAMER = Symbol('ReviewAuthorRenamerPort');
export const AUTH_CLOCK = Symbol('ClockPort');
export const FRONT_BASE_URL = Symbol('FrontBaseUrl');

// Fase 3b — sesión con refresh rotativo e identidad de Google.
export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepositoryPort');
export const GOOGLE_IDENTITY = Symbol('GoogleIdentityPort');
export const SESSION_CONFIG = Symbol('SessionConfig'); // vigencias y opciones de cookie

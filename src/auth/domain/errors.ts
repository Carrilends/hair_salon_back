export abstract class AuthDomainError extends Error {}

export class InvalidEmailError extends AuthDomainError {
  constructor(value: string) {
    super(`Correo electrónico inválido: ${value}`);
    this.name = 'InvalidEmailError';
  }
}
export class InvalidCredentialsError extends AuthDomainError {
  constructor() {
    super('Credenciales inválidas');
    this.name = 'InvalidCredentialsError';
  }
}
export class UserNotFoundError extends AuthDomainError {
  constructor() {
    super('Usuario no encontrado');
    this.name = 'UserNotFoundError';
  }
}
export class EmailAlreadyInUseError extends AuthDomainError {
  constructor() {
    super('El correo ya está registrado');
    this.name = 'EmailAlreadyInUseError';
  }
}
export class SameEmailError extends AuthDomainError {
  constructor() {
    super('El nuevo correo debe ser distinto del actual');
    this.name = 'SameEmailError';
  }
}
export class SamePasswordError extends AuthDomainError {
  constructor() {
    super('La nueva contraseña debe ser distinta de la actual');
    this.name = 'SamePasswordError';
  }
}
export class InactiveUserError extends AuthDomainError {
  constructor() {
    super('La cuenta está inactiva');
    this.name = 'InactiveUserError';
  }
}
export class ExpiredAuthTokenError extends AuthDomainError {
  constructor() {
    super('El enlace expiró; solicita uno nuevo');
    this.name = 'ExpiredAuthTokenError';
  }
}
export class AuthTokenAlreadyUsedError extends AuthDomainError {
  constructor() {
    super('El enlace ya fue utilizado');
    this.name = 'AuthTokenAlreadyUsedError';
  }
}
export class AuthTokenNotFoundError extends AuthDomainError {
  constructor() {
    super('El enlace no es válido');
    this.name = 'AuthTokenNotFoundError';
  }
}
export class EmailAlreadyVerifiedError extends AuthDomainError {
  constructor() {
    super('El correo ya está verificado');
    this.name = 'EmailAlreadyVerifiedError';
  }
}
export class InvalidRefreshTokenError extends AuthDomainError {
  constructor() {
    super('La sesión no es válida; inicia sesión de nuevo');
    this.name = 'InvalidRefreshTokenError';
  }
}

/**
 * Se presentó un refresh token que ya había sido rotado. O bien la cookie fue
 * robada, o bien el cliente reintentó con un valor viejo. En ambos casos la
 * respuesta correcta es revocar la familia completa (S2).
 */
export class RefreshTokenReuseDetectedError extends AuthDomainError {
  constructor() {
    super('Se detectó un uso indebido de la sesión; vuelve a iniciar sesión');
    this.name = 'RefreshTokenReuseDetectedError';
  }
}
export class GoogleAccountNotVerifiedError extends AuthDomainError {
  constructor() {
    super('La cuenta de Google no tiene el correo verificado');
    this.name = 'GoogleAccountNotVerifiedError';
  }
}
export class DataPolicyConsentRequiredError extends AuthDomainError {
  constructor() {
    super('Debe aceptar la Política de Tratamiento de Datos Personales');
    this.name = 'DataPolicyConsentRequiredError';
  }
}

/**
 * Las cuentas de administración no pueden borrarse a sí mismas (eliminar la
 * cuenta, 2026-10-28): el portal no muestra la acción y el servidor la niega
 * igual, por si se llama a la API directamente. Se responde 403.
 */
export class AdminAccountDeletionError extends AuthDomainError {
  constructor() {
    super('Las cuentas de administración no pueden eliminarse');
    this.name = 'AdminAccountDeletionError';
  }
}

/**
 * La confirmación para eliminar la cuenta (contraseña, o correo si la cuenta
 * es solo de Google) no coincide. Se responde 422 y no 401: la sesión sí es
 * válida, y un 401 haría que el portal renovara la sesión y repitiera la
 * petición, gastando dos intentos por cada contraseña mala.
 */
export class AccountDeletionConfirmationError extends AuthDomainError {
  constructor() {
    super('La confirmación no coincide; revisa la contraseña o el correo');
    this.name = 'AccountDeletionConfirmationError';
  }
}

/**
 * Demasiadas confirmaciones fallidas seguidas (contraseña o correo). Se
 * responde 429 hasta que la ventana pase.
 */
export class TooManyAttemptsError extends AuthDomainError {
  constructor() {
    super('Demasiados intentos; espera unos minutos y vuelve a intentarlo');
    this.name = 'TooManyAttemptsError';
  }
}

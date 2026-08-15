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

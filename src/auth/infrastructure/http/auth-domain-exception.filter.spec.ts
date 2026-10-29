import { AuthDomainExceptionFilter } from './auth-domain-exception.filter';
import {
  AccountDeletionConfirmationError,
  AdminAccountDeletionError,
  InvalidCredentialsError,
  AuthTokenAlreadyUsedError,
  AuthTokenNotFoundError,
  ExpiredAuthTokenError,
  TooManyAttemptsError,
} from '../../domain/errors';

/** Respuesta de Express mínima: solo anota lo que el filtro le pide. */
function traducir(error: any) {
  const salida: { status?: number; body?: any } = {};
  const res = {
    status(code: number) {
      salida.status = code;
      return this;
    },
    json(body: unknown) {
      salida.body = body;
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as any;
  new AuthDomainExceptionFilter().catch(error, host);
  return salida;
}

describe('AuthDomainExceptionFilter', () => {
  it.each([
    [new AuthTokenAlreadyUsedError(), 'TOKEN_USADO'],
    [new ExpiredAuthTokenError(), 'TOKEN_CADUCADO'],
    [new AuthTokenNotFoundError(), 'TOKEN_INVALIDO'],
  ])('%s responde 400 con su code', (error, code) => {
    const { status, body } = traducir(error);
    expect(status).toBe(400);
    expect(body.code).toBe(code);
    expect(body.message).toBe(error.message);
  });
  it('una cuenta admin que intenta borrarse responde 403', () => {
    const { status, body } = traducir(new AdminAccountDeletionError());
    expect(status).toBe(403);
    expect(body.message).toMatch(/administración/);
  });

  it('demasiados intentos responde 429', () => {
    const { status, body } = traducir(new TooManyAttemptsError());
    expect(status).toBe(429);
    expect(body.statusCode).toBe(429);
  });
  it('una confirmación mala al eliminar la cuenta responde 422, no 401', () => {
    const { status, body } = traducir(new AccountDeletionConfirmationError());
    expect(status).toBe(422);
    expect(body.statusCode).toBe(422);
    expect(body.message).toMatch(/confirmación/);
  });

  it('las credenciales inválidas del inicio de sesión siguen en 401', () => {
    expect(traducir(new InvalidCredentialsError()).status).toBe(401);
  });
});

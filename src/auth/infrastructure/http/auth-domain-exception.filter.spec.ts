import { AuthDomainExceptionFilter } from './auth-domain-exception.filter';
import {
  AdminAccountDeletionError,
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
});

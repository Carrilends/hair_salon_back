import { AuthDomainExceptionFilter } from './auth-domain-exception.filter';
import {
  AuthTokenAlreadyUsedError,
  AuthTokenNotFoundError,
  ExpiredAuthTokenError,
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
});

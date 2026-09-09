import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { McpOriginGuard } from './mcp-origin.guard';

/** Contexto minimo de Nest con las cabeceras que le interesan al guard. */
const contextoCon = (headers: Record<string, string>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('McpOriginGuard', () => {
  const original = process.env.MCP_ALLOWED_ORIGINS;

  afterEach(() => {
    if (original === undefined) delete process.env.MCP_ALLOWED_ORIGINS;
    else process.env.MCP_ALLOWED_ORIGINS = original;
  });

  it('deja pasar una peticion sin cabecera Origin', () => {
    // Los clientes MCP de escritorio no la envian; la especificacion obliga a
    // rechazar cuando esta presente y es invalida, no a exigir su presencia.
    delete process.env.MCP_ALLOWED_ORIGINS;

    expect(new McpOriginGuard().canActivate(contextoCon({}))).toBe(true);
  });

  it('rechaza un origen ajeno con 403', () => {
    // Sin esta comprobacion, una pagina cualquiera abierta en el navegador de la
    // clienta podria emitir peticiones contra el servidor (reenlace de DNS).
    delete process.env.MCP_ALLOWED_ORIGINS;
    const guard = new McpOriginGuard();

    expect(() =>
      guard.canActivate(
        contextoCon({ origin: 'https://sitio-atacante.example' }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('admite por defecto los origenes de localhost', () => {
    delete process.env.MCP_ALLOWED_ORIGINS;

    expect(
      new McpOriginGuard().canActivate(
        contextoCon({ origin: 'http://localhost:9000' }),
      ),
    ).toBe(true);
  });

  it('honra la lista blanca de MCP_ALLOWED_ORIGINS', () => {
    process.env.MCP_ALLOWED_ORIGINS = 'peluqueriamarlene.com';
    const guard = new McpOriginGuard();

    expect(
      guard.canActivate(
        contextoCon({ origin: 'https://peluqueriamarlene.com' }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextoCon({ origin: 'http://localhost:9000' })),
    ).toThrow(ForbiddenException);
  });
});

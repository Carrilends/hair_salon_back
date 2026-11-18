import { sign, type SignOptions } from 'jsonwebtoken';
import {
  CABECERA_FIRMA_NETLIFY,
  CABECERA_IP_NETLIFY,
  ipDeLaClientaSegunNetlify,
  middlewareIpDeNetlify,
} from './netlify-client-ip';

const SECRETO = 'secreto-de-prueba-con-longitud-suficiente';

function firma(
  carga: Record<string, unknown> = { iss: 'netlify' },
  secreto = SECRETO,
  opciones: SignOptions = { expiresIn: 60 },
) {
  return sign(carga, secreto, { ...opciones, algorithm: 'HS256' });
}

describe('ipDeLaClientaSegunNetlify', () => {
  it('devuelve la IP de Netlify cuando la firma es válida', () => {
    expect(
      ipDeLaClientaSegunNetlify(
        {
          [CABECERA_FIRMA_NETLIFY]: firma(),
          [CABECERA_IP_NETLIFY]: '181.63.150.52',
        },
        SECRETO,
      ),
    ).toBe('181.63.150.52');
  });

  it('acepta IPv6', () => {
    expect(
      ipDeLaClientaSegunNetlify(
        {
          [CABECERA_FIRMA_NETLIFY]: firma(),
          [CABECERA_IP_NETLIFY]: '2800:484:1:2::5',
        },
        SECRETO,
      ),
    ).toBe('2800:484:1:2::5');
  });

  it('sin secreto configurado no confía en nada', () => {
    expect(
      ipDeLaClientaSegunNetlify(
        {
          [CABECERA_FIRMA_NETLIFY]: firma(),
          [CABECERA_IP_NETLIFY]: '181.63.150.52',
        },
        undefined,
      ),
    ).toBeNull();
  });

  it('sin firma, la cabecera de IP se ignora (cualquiera puede escribirla)', () => {
    expect(
      ipDeLaClientaSegunNetlify(
        { [CABECERA_IP_NETLIFY]: '203.0.113.9' },
        SECRETO,
      ),
    ).toBeNull();
  });

  it('rechaza una firma hecha con otro secreto', () => {
    expect(
      ipDeLaClientaSegunNetlify(
        {
          [CABECERA_FIRMA_NETLIFY]: firma({ iss: 'netlify' }, 'otro-secreto'),
          [CABECERA_IP_NETLIFY]: '203.0.113.9',
        },
        SECRETO,
      ),
    ).toBeNull();
  });

  it('rechaza una firma caducada', () => {
    const caducada = firma(
      { iss: 'netlify', exp: Math.floor(Date.now() / 1000) - 10 },
      SECRETO,
      {},
    );
    expect(
      ipDeLaClientaSegunNetlify(
        {
          [CABECERA_FIRMA_NETLIFY]: caducada,
          [CABECERA_IP_NETLIFY]: '203.0.113.9',
        },
        SECRETO,
      ),
    ).toBeNull();
  });

  it('rechaza una firma de otro emisor', () => {
    expect(
      ipDeLaClientaSegunNetlify(
        {
          [CABECERA_FIRMA_NETLIFY]: firma({ iss: 'otro' }),
          [CABECERA_IP_NETLIFY]: '203.0.113.9',
        },
        SECRETO,
      ),
    ).toBeNull();
  });

  it('rechaza el algoritmo «none»', () => {
    const sinFirmar = sign({ iss: 'netlify' }, '', { algorithm: 'none' });
    expect(
      ipDeLaClientaSegunNetlify(
        {
          [CABECERA_FIRMA_NETLIFY]: sinFirmar,
          [CABECERA_IP_NETLIFY]: '203.0.113.9',
        },
        SECRETO,
      ),
    ).toBeNull();
  });

  it('con firma válida pero sin IP utilizable, devuelve null', () => {
    expect(
      ipDeLaClientaSegunNetlify({ [CABECERA_FIRMA_NETLIFY]: firma() }, SECRETO),
    ).toBeNull();
    expect(
      ipDeLaClientaSegunNetlify(
        {
          [CABECERA_FIRMA_NETLIFY]: firma(),
          [CABECERA_IP_NETLIFY]: 'no-es-una-ip',
        },
        SECRETO,
      ),
    ).toBeNull();
  });

  it('con la cabecera repetida usa la primera', () => {
    expect(
      ipDeLaClientaSegunNetlify(
        {
          [CABECERA_FIRMA_NETLIFY]: [firma()],
          [CABECERA_IP_NETLIFY]: ['181.63.150.52', '203.0.113.9'],
        },
        SECRETO,
      ),
    ).toBe('181.63.150.52');
  });
});

describe('middlewareIpDeNetlify', () => {
  function peticion(cabeceras: Record<string, string>) {
    const req = { headers: cabeceras } as unknown as {
      headers: Record<string, string>;
      ip?: string;
    };
    // Como Express: `ip` es un getter del prototipo, no una propiedad propia.
    Object.defineProperty(req, 'ip', {
      get: () => '100.64.0.1',
      configurable: true,
    });
    return req;
  }

  it('sustituye req.ip cuando la firma es válida', () => {
    const req = peticion({
      [CABECERA_FIRMA_NETLIFY]: firma(),
      [CABECERA_IP_NETLIFY]: '181.63.150.52',
    });
    const siguiente = jest.fn();
    middlewareIpDeNetlify(SECRETO)(req as never, {} as never, siguiente);
    expect(req.ip).toBe('181.63.150.52');
    expect(siguiente).toHaveBeenCalledTimes(1);
  });

  it('deja req.ip intacta sin firma válida', () => {
    const req = peticion({ [CABECERA_IP_NETLIFY]: '203.0.113.9' });
    const siguiente = jest.fn();
    middlewareIpDeNetlify(SECRETO)(req as never, {} as never, siguiente);
    expect(req.ip).toBe('100.64.0.1');
    expect(siguiente).toHaveBeenCalledTimes(1);
  });
});

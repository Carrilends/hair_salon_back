import { CLAVE_DESCONOCIDA, clavePorIp } from './client-ip';

describe('clavePorIp', () => {
  it('usa la IPv4 tal cual', () => {
    expect(clavePorIp({ ip: '190.24.1.5' })).toBe('190.24.1.5');
  });

  it('desenvuelve la IPv4 mapeada en IPv6 que entrega Node en un socket dual', () => {
    expect(clavePorIp({ ip: '::ffff:190.24.1.5' })).toBe('190.24.1.5');
  });

  it('recorta la IPv6 a su /64: un cliente con un prefijo entero no rota direcciones para saltarse el tope', () => {
    expect(clavePorIp({ ip: '2800:484:1c7b:1200:ab:cd:ef:1' })).toBe(
      '2800:484:1c7b:1200',
    );
    expect(clavePorIp({ ip: '2800:484:1c7b:1200:99:88:77:66' })).toBe(
      '2800:484:1c7b:1200',
    );
  });

  it('expande la forma comprimida antes de recortar', () => {
    expect(clavePorIp({ ip: '2800:484::1' })).toBe('2800:484:0:0');
  });

  it('normaliza los ceros a la izquierda para que dos escrituras de la misma red compartan cubo', () => {
    expect(clavePorIp({ ip: '2800:0484:1c7b:1200::1' })).toBe(
      clavePorIp({ ip: '2800:484:1c7b:1200::2' }),
    );
  });

  it('descarta el identificador de zona', () => {
    expect(clavePorIp({ ip: 'fe80::1%eth0' })).toBe('fe80:0:0:0');
  });

  describe('lo que no es una dirección no abre cubos nuevos', () => {
    // Con saltos de proxy declarados, `req.ip` sale de `X-Forwarded-For`, que
    // la escribe el cliente. Si cualquier cadena valiera como clave, bastaría
    // con mandar una distinta en cada petición para tener tope infinito —y de
    // paso hacer crecer el mapa una entrada por petición—.
    it('una cadena arbitraria cae al cubo compartido', () => {
      expect(clavePorIp({ ip: 'no-soy-una-ip' })).toBe(CLAVE_DESCONOCIDA);
      expect(clavePorIp({ ip: 'a'.repeat(200) })).toBe(CLAVE_DESCONOCIDA);
    });

    it('una IPv6 con basura no se confunde con la red legítima que empieza igual', () => {
      // `parseInt('12zz', 16)` es 18, así que sin validar esta dirección
      // inventada caía en el mismo cubo que la red real `12:0:0:0::`.
      expect(clavePorIp({ ip: '12zz:0:0:0:1:2:3:4' })).toBe(CLAVE_DESCONOCIDA);
    });

    it('una dirección con puerto pegado no es una dirección', () => {
      expect(clavePorIp({ ip: '1.2.3.4:5678' })).toBe(CLAVE_DESCONOCIDA);
    });

    it('una IPv4 fuera de rango tampoco pasa', () => {
      expect(clavePorIp({ ip: '999.1.1.1' })).toBe(CLAVE_DESCONOCIDA);
    });
  });

  it('sin IP devuelve una clave compartida: falla cerrado, no abierto', () => {
    expect(clavePorIp({})).toBe(CLAVE_DESCONOCIDA);
    expect(clavePorIp({ ip: '' })).toBe(CLAVE_DESCONOCIDA);
    expect(clavePorIp({ ip: '   ' })).toBe(CLAVE_DESCONOCIDA);
  });
});

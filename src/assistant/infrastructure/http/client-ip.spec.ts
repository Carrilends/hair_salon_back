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

  it('sin IP devuelve una clave compartida: falla cerrado, no abierto', () => {
    expect(clavePorIp({})).toBe(CLAVE_DESCONOCIDA);
    expect(clavePorIp({ ip: '' })).toBe(CLAVE_DESCONOCIDA);
    expect(clavePorIp({ ip: '   ' })).toBe(CLAVE_DESCONOCIDA);
  });
});

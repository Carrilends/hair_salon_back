import { MODOS, modoDeEntorno } from './judgment-settings';

describe('modoDeEntorno', () => {
  const guardado = process.env.X_MODO;
  afterEach(() => {
    if (guardado === undefined) delete process.env.X_MODO;
    else process.env.X_MODO = guardado;
  });

  it('sin variable declarada usa el valor por defecto', () => {
    delete process.env.X_MODO;
    expect(modoDeEntorno('X_MODO', 'off', () => {})).toBe('off');
  });

  it.each(MODOS)('acepta %s', (modo) => {
    process.env.X_MODO = modo;
    expect(modoDeEntorno('X_MODO', 'off', () => {})).toBe(modo);
  });

  it('no distingue mayúsculas ni espacios alrededor', () => {
    process.env.X_MODO = '  Shadow ';
    expect(modoDeEntorno('X_MODO', 'off', () => {})).toBe('shadow');
  });

  it.each(['', 'si', 'true', '1', 'ON=on'])(
    'un valor ilegible (%s) NO enciende nada: cae a off y avisa',
    (crudo) => {
      // Mismo criterio que `enteroDeEntorno`: un valor mal escrito no puede
      // cambiar el comportamiento en silencio. Y aquí el valor seguro es `off`,
      // porque encender una colocación por un error de tecleo pondría a juzgar
      // turnos de clientas reales sin que nadie lo haya decidido.
      process.env.X_MODO = crudo;
      const avisos: string[] = [];
      expect(modoDeEntorno('X_MODO', 'shadow', (m) => avisos.push(m))).toBe(
        'off',
      );
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toContain('X_MODO');
    },
  );
});

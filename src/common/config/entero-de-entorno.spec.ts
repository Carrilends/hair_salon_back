import { enteroDeEntorno } from './entero-de-entorno';

describe('enteroDeEntorno', () => {
  const avisos: string[] = [];
  const avisar = (m: string) => void avisos.push(m);

  beforeEach(() => {
    avisos.length = 0;
    delete process.env.PRUEBA_TOPE;
  });

  it('sin definir usa el valor por defecto y no avisa', () => {
    expect(enteroDeEntorno('PRUEBA_TOPE', 20, avisar)).toBe(20);
    expect(avisos).toEqual([]);
  });

  it('un entero válido se usa tal cual, incluido el cero', () => {
    process.env.PRUEBA_TOPE = '35';
    expect(enteroDeEntorno('PRUEBA_TOPE', 20, avisar)).toBe(35);
    process.env.PRUEBA_TOPE = '0';
    expect(enteroDeEntorno('PRUEBA_TOPE', 20, avisar)).toBe(0);
    expect(avisos).toEqual([]);
  });

  describe('lo que antes desactivaba el tope en silencio', () => {
    // `Number('200_000')` es NaN, y una comparación contra NaN siempre es
    // falsa: el tope dejaba de disparar sin que nada lo dijera. El separador de
    // millares es justo como está escrito el valor por defecto en el código,
    // así que copiarlo era el error más fácil de cometer.
    it('un separador de millares cae al valor por defecto y avisa', () => {
      process.env.PRUEBA_TOPE = '200_000';
      expect(enteroDeEntorno('PRUEBA_TOPE', 20, avisar)).toBe(20);
      expect(avisos.join()).toContain('PRUEBA_TOPE');
    });

    it('un comentario pegado al valor cae al valor por defecto y avisa', () => {
      process.env.PRUEBA_TOPE = '20 # por hora';
      expect(enteroDeEntorno('PRUEBA_TOPE', 20, avisar)).toBe(20);
      expect(avisos).toHaveLength(1);
    });

    it('la variable vacía se trata como no definida, no como cero', () => {
      // En los paneles de despliegue una variable puede quedar declarada y sin
      // valor. `Number('')` es 0, y un tope de cero rechaza a todo el mundo:
      // el asistente se quedaría mudo para el público sin decir por qué.
      process.env.PRUEBA_TOPE = '   ';
      expect(enteroDeEntorno('PRUEBA_TOPE', 20, avisar)).toBe(20);
      expect(avisos).toHaveLength(1);
    });

    it('un valor negativo cae al valor por defecto y avisa', () => {
      process.env.PRUEBA_TOPE = '-5';
      expect(enteroDeEntorno('PRUEBA_TOPE', 20, avisar)).toBe(20);
      expect(avisos).toHaveLength(1);
    });

    it('un decimal cae al valor por defecto y avisa', () => {
      process.env.PRUEBA_TOPE = '1.5';
      expect(enteroDeEntorno('PRUEBA_TOPE', 20, avisar)).toBe(20);
      expect(avisos).toHaveLength(1);
    });
  });

  it('el aviso dice qué se leyó y con qué se siguió', () => {
    process.env.PRUEBA_TOPE = 'veinte';
    enteroDeEntorno('PRUEBA_TOPE', 20, avisar);
    expect(avisos[0]).toContain('veinte');
    expect(avisos[0]).toContain('20');
  });
});

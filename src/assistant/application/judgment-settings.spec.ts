import {
  MODOS,
  ajustesDeJuicioDeEntorno,
  modoDeEntorno,
} from './judgment-settings';

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

describe('ajustesDeJuicioDeEntorno', () => {
  const guardadas = { ...process.env };
  afterEach(() => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('ASSISTANT_JUDGE_')) delete process.env[k];
    }
    Object.assign(process.env, guardadas);
  });

  it('con proveedor disponible, respeta lo que diga el entorno', () => {
    process.env.ASSISTANT_JUDGE_RESERVATION = 'on';
    process.env.ASSISTANT_JUDGE_LOOP = 'shadow';

    expect(ajustesDeJuicioDeEntorno(true, () => {})).toEqual({
      reserva: 'on',
      bucle: 'shadow',
      orden: 'off',
      diferido: false,
    });
  });

  it('sin proveedor, TODO queda apagado y se avisa de lo que se ignoró', () => {
    // El fallo que nadie relacionaría con la causa: el interruptor encendido y
    // la clave sin aprovisionar. Antes costaba una consulta a la base por turno
    // que reservara y no producía ni una línea de log.
    process.env.ASSISTANT_JUDGE_RESERVATION = 'on';
    process.env.ASSISTANT_JUDGE_DEFERRED = 'on';
    const avisos: string[] = [];

    const ajustes = ajustesDeJuicioDeEntorno(false, (m) => avisos.push(m));

    expect(ajustes).toEqual({
      reserva: 'off',
      bucle: 'off',
      orden: 'off',
      diferido: false,
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('ASSISTANT_JUDGE_RESERVATION');
    expect(avisos[0]).toContain('ASSISTANT_JUDGE_DEFERRED');
  });

  it('sin proveedor y con todo apagado, no avisa de nada', () => {
    const avisos: string[] = [];

    ajustesDeJuicioDeEntorno(false, (m) => avisos.push(m));

    expect(avisos).toHaveLength(0);
  });
});

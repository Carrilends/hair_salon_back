import {
  coincidenEnNombre,
  conceptoDe,
  sinPalabrasDeTodo,
  estaAnclado,
  yaPreguntoSobre,
  MAX_SERVICIOS_WHATSAPP,
} from './catalogo-acotado';

const r = (texto: string, rol: 'clienta' | 'asistente' = 'clienta') => ({
  rol,
  texto,
});

describe('catalogo-acotado', () => {
  it('fija el máximo de WhatsApp en 6', () => {
    expect(MAX_SERVICIOS_WHATSAPP).toBe(6);
  });
  it('pedir el catálogo no es un concepto', () => {
    expect(conceptoDe('el catálogo completo')).toEqual([]);
    expect(conceptoDe('catálogo')).toEqual([]);
    expect(conceptoDe('unas mechas')).toEqual(['mechas', 'unas']);
  });
  it('M1 «todo» y «todas» también son pedir todo', () => {
    expect(conceptoDe('todas')).toEqual([]);
    expect(conceptoDe('todo')).toEqual([]);
    expect(conceptoDe('todas las uñas')).toEqual(['unas']);
    expect(sinPalabrasDeTodo('todas las uñas')).toBe('las uñas');
    expect(sinPalabrasDeTodo('todo de corte')).toBe('de corte');
    expect(sinPalabrasDeTodo('todo')).toBe('');
  });
  it('ancla por raíz y sin tildes', () => {
    expect(estaAnclado(['corte'], [r('quiero cortarme el pelo')])).toBe(true);
    expect(estaAnclado(['cejas'], [r('me arreglo la CEJA')])).toBe(true);
    expect(estaAnclado(['tinte'], [r('quiero una tintura')])).toBe(true);
  });
  it('no ancla lo que nadie mencionó', () => {
    expect(estaAnclado(['balayage'], [r('hola, ¿qué tienen?')])).toBe(false);
  });
  it('lo mencionado por el asistente ancla la respuesta «sí»', () => {
    expect(
      estaAnclado(['tintes'], [r('¿Buscas tintes?', 'asistente'), r('sí')]),
    ).toBe(true);
  });
  it('sin mensajes recientes no ancla: falla cerrado', () => {
    expect(estaAnclado(['corte'], [])).toBe(false);
  });
  it('ya preguntó solo si el ÚLTIMO del asistente tiene «?» y el concepto', () => {
    expect(
      yaPreguntoSobre(
        ['alisado'],
        [r('¿Qué tipo de alisado?', 'asistente'), r('cualquiera')],
      ),
    ).toBe(true);
    expect(
      yaPreguntoSobre(
        ['alisado'],
        [r('¿Cómo te llamas?', 'asistente'), r('Ana, alisado')],
      ),
    ).toBe(false);
    expect(
      yaPreguntoSobre(
        ['alisado'],
        [r('Tenemos alisado.', 'asistente'), r('ok')],
      ),
    ).toBe(false);
  });
  it('coincidenEnNombre exige todas las palabras', () => {
    const s = [
      { nombre: 'Balayage clásico' },
      { nombre: 'Mechas californianas' },
    ];
    expect(coincidenEnNombre(s, ['balayage'])).toEqual([s[0]]);
    expect(coincidenEnNombre(s, ['balayage', 'mechas'])).toEqual([]);
  });
  it('sinPalabrasDeTodo quita solo las palabras de «dame todo»', () => {
    expect(sinPalabrasDeTodo('catálogo de uñas')).toBe('de uñas');
    expect(sinPalabrasDeTodo('todos los cortes')).toBe('los cortes');
    expect(sinPalabrasDeTodo('Menú, corte para mujer barato')).toBe(
      'corte para mujer barato',
    );
    expect(sinPalabrasDeTodo('catálogo')).toBe('');
    expect(sinPalabrasDeTodo(undefined)).toBeUndefined();
  });
});

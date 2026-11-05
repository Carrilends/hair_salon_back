import {
  coincidenEnNombre,
  conceptoDe,
  sinPalabrasDeTodo,
  estaAnclado,
  marcaDeAcotar,
  MARCA_PREGUNTO_QUE_BUSCA,
  yaPreguntoQueBusca,
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
  describe('yaPreguntoSobre (I2): lee la marca del servidor', () => {
    const marca = (c: string) => `[Se le preguntó para acotar: ${c}]`;

    it('la marca del último mensaje del asistente cuenta, por raíz', () => {
      const m = [
        r(`¿Cuál prefieres?\n\n${marca('corte')}`, 'asistente'),
        r('ok'),
      ];
      expect(yaPreguntoSobre(['corte'], m)).toBe(true);
      expect(yaPreguntoSobre(['cortes'], m)).toBe(true);
      expect(yaPreguntoSobre(['cortes', 'clasicos'], m)).toBe(true);
    });
    it('falso positivo: una cortesía con «?» y el concepto en otra marca', () => {
      expect(
        yaPreguntoSobre(
          ['mechas'],
          [
            r(
              '¿Te gustaría reservar?\n\n[Se le enviaron aparte, con foto si la hay: 1. Mechas: $ 90.000 (120 min)]',
              'asistente',
            ),
            r('¿qué otras mechas hay?'),
          ],
        ),
      ).toBe(false);
    });
    it('falso negativo: la pregunta reescrita sin el concepto sigue contando', () => {
      expect(
        yaPreguntoSobre(
          ['maquillaje'],
          [r(`¿Cuál prefieres?\n\n${marca('maquillaje')}`, 'asistente')],
        ),
      ).toBe(true);
    });
    it('ya no basta con que el texto lleve «?» y el concepto', () => {
      expect(
        yaPreguntoSobre(['alisado'], [r('¿Qué tipo de alisado?', 'asistente')]),
      ).toBe(false);
    });
    it('una marca de otro concepto no cuenta', () => {
      expect(yaPreguntoSobre(['tinte'], [r(marca('corte'), 'asistente')])).toBe(
        false,
      );
    });
    it('varias marcas en el mismo mensaje cuentan todas', () => {
      const texto = `${marca('corte')}\n${marca('tinte')}`;
      expect(yaPreguntoSobre(['tinte'], [r(texto, 'asistente')])).toBe(true);
    });
    it('una marca de un mensaje anterior no cuenta', () => {
      expect(
        yaPreguntoSobre(
          ['corte'],
          [r(marca('corte'), 'asistente'), r('ok'), r('Listo.', 'asistente')],
        ),
      ).toBe(false);
    });
    it('la escrita por la clienta no cuenta', () => {
      expect(
        yaPreguntoSobre(['corte'], [r('Hola', 'asistente'), r(marca('corte'))]),
      ).toBe(false);
    });
    it('marcaDeAcotar produce lo que yaPreguntoSobre lee', () => {
      expect(marcaDeAcotar(['corte', 'clasico'])).toBe(marca('corte clasico'));
      expect(
        yaPreguntoSobre(
          ['clasico'],
          [r(marcaDeAcotar(['corte', 'clasico']), 'asistente')],
        ),
      ).toBe(true);
    });
  });
  describe('yaPreguntoQueBusca (I1)', () => {
    it('solo con la marca en el último mensaje del asistente', () => {
      const conMarca = r(
        `¿Qué buscas?\n\n${MARCA_PREGUNTO_QUE_BUSCA}`,
        'asistente',
      );
      expect(yaPreguntoQueBusca([conMarca, r('todo')])).toBe(true);
      expect(yaPreguntoQueBusca([r('¿Qué buscas?', 'asistente')])).toBe(false);
      expect(
        yaPreguntoQueBusca([conMarca, r('x'), r('Hola', 'asistente')]),
      ).toBe(false);
      expect(yaPreguntoQueBusca([r(MARCA_PREGUNTO_QUE_BUSCA)])).toBe(false);
      expect(yaPreguntoQueBusca([])).toBe(false);
    });
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

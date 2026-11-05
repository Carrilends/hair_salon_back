import {
  lineaDeServicio,
  marcaDeServicios,
  marcasDeAcotado,
  pideConfirmacion,
  serviciosDelTurno,
  sinMarcasCopiadas,
} from './servicios-del-turno';
import {
  AssistantPresentation,
  PresentedService,
} from './assistant-presentation';

const s = (id: string, nombre = id): PresentedService => ({
  id,
  nombre,
  precio: 35000,
  minutos: 45,
});
const lista = (...ss: PresentedService[]): AssistantPresentation => ({
  tipo: 'servicios',
  servicios: ss,
});
const confirmar: AssistantPresentation = {
  tipo: 'confirmar-reserva',
  propuestaId: 'p',
  nombre: 'n',
  servicios: [],
  fecha: 'f',
  hora: 'h',
};

describe('servicios del turno', () => {
  it('quita repetidos entre presentaciones y limita a 6', () => {
    const r = serviciosDelTurno([
      lista(s('a'), s('b'), s('c')),
      lista(s('b'), s('d'), s('e'), s('f'), s('g'), s('h')),
    ]);
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('la línea lleva número, nombre, precio y duración', () => {
    expect(
      lineaDeServicio(
        { id: 'a', nombre: 'Corte', precio: 35000, minutos: 45 },
        0,
      ),
    ).toMatch(/^1\. Corte: \$\s?35\.000 \(45 min\)$/);
  });

  it('pideConfirmacion detecta las tres confirmaciones', () => {
    expect(pideConfirmacion([confirmar])).toBe(true);
    expect(pideConfirmacion([lista(s('a'))])).toBe(false);
  });

  it('la marca no lleva ids ni URL', () => {
    const m = marcaDeServicios([
      lista({ ...s('id-1', 'A'), imagen: 'https://res.cloudinary.com/x.jpg' }),
    ]);
    expect(m).toMatch(/^\[Se le enviaron aparte, con foto si la hay: 1\. A: /);
    expect(m).not.toContain('id-1');
    expect(m).not.toContain('cloudinary');
  });

  it('sin marca si el turno pide confirmación o no hay servicios', () => {
    expect(marcaDeServicios([lista(s('a')), confirmar])).toBe('');
    expect(marcaDeServicios([])).toBe('');
  });
});

describe('marcasDeAcotado', () => {
  const porCategoria: AssistantPresentation = {
    tipo: 'servicios',
    servicios: [],
    criterio: 'menor_precio_por_categoria',
  };

  it('«demasiados» anota el concepto; «falta_concepto», el hecho', () => {
    expect(
      marcasDeAcotado(
        [
          { ok: false, motivo: 'demasiados', concepto: ['corte'] },
          { ok: false, motivo: 'falta_concepto' },
        ],
        [],
      ),
    ).toEqual([
      '[Se le preguntó para acotar: corte]',
      '[Se le preguntó qué busca]',
    ]);
  });

  it('otros motivos, resultados normales y nulos no anotan nada', () => {
    expect(
      marcasDeAcotado(
        [
          { ok: false, motivo: 'sin_pedirlo', pregunta: '¿?' },
          { ok: false, motivo: 'tope_del_turno', pregunta: '¿?' },
          { servicios: [] },
          { ok: true, motivo: 'demasiados', concepto: ['corte'] },
          { ok: false, motivo: 'demasiados' },
          null,
        ],
        [],
      ),
    ).toEqual([]);
  });

  it('dos preguntas iguales se anotan una vez', () => {
    const r = { ok: false, motivo: 'demasiados', concepto: ['corte'] };
    expect(marcasDeAcotado([r, { ...r }], [])).toHaveLength(1);
  });

  it('el listado por categoría cuenta como preguntar qué busca', () => {
    expect(marcasDeAcotado([], [porCategoria])).toEqual([
      '[Se le preguntó qué busca]',
    ]);
  });

  it('el de los 6 de menor precio no, y con botón de confirmar tampoco', () => {
    expect(
      marcasDeAcotado(
        [],
        [{ tipo: 'servicios', servicios: [], criterio: 'menor_precio' }],
      ),
    ).toEqual([]);
    expect(
      marcasDeAcotado(
        [],
        [
          porCategoria,
          {
            tipo: 'confirmar-reserva',
            propuestaId: 'p',
            nombre: 'Ana',
            servicios: [],
            fecha: 'f',
            hora: 'h',
          },
        ],
      ),
    ).toEqual([]);
  });
});

describe('sinMarcasCopiadas', () => {
  it('quita exactamente lo que el servidor anota', () => {
    const servicios: AssistantPresentation = {
      tipo: 'servicios',
      servicios: [{ id: 's', nombre: 'Corte [U]', precio: 1, minutos: 1 }],
    };
    const anotadas = [
      ...marcasDeAcotado(
        [
          { ok: false, motivo: 'demasiados', concepto: ['corte'] },
          { ok: false, motivo: 'falta_concepto' },
        ],
        [],
      ),
      marcaDeServicios([
        {
          ...servicios,
          servicios: [{ ...servicios.servicios[0], nombre: 'Corte' }],
        },
      ]),
    ];
    expect(anotadas).toHaveLength(3);
    for (const marca of anotadas) {
      expect(sinMarcasCopiadas(`Hola.\n\n${marca}`)).toBe('Hola.');
      expect(sinMarcasCopiadas(marca)).toBe('');
    }
  });

  it('un texto sin marcas queda intacto, espacios incluidos', () => {
    const texto = '  a  b\n\n\n[Se le mostró aparte] [nota] ';
    expect(sinMarcasCopiadas(texto)).toBe(texto);
  });
});

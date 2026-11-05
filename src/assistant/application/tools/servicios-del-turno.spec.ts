import {
  lineaDeServicio,
  marcaDeServicios,
  pideConfirmacion,
  serviciosDelTurno,
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

import { compose, PackageCandidate } from './package-composer';
import { EVENT_TEMPLATES } from './event-template';

function candidatos(
  entries: [string, PackageCandidate[]][],
): Map<string, PackageCandidate[]> {
  return new Map(entries);
}

const boda = candidatos([
  [
    'Recogidos',
    [
      {
        id: 'r1',
        name: 'Recogido con ondas',
        price: 60000,
        durationMinutes: 60,
      },
    ],
  ],
  [
    'Novia',
    [
      {
        id: 'm1',
        name: 'Maquillaje de novia natural',
        price: 90000,
        durationMinutes: 60,
      },
      {
        id: 'm2',
        name: 'Maquillaje de novia glam',
        price: 150000,
        durationMinutes: 90,
      },
    ],
  ],
  [
    'Manicure',
    [{ id: 'u1', name: 'Manicure francés', price: 35000, durationMinutes: 45 }],
  ],
]);

describe('compose', () => {
  it('elige el más barato que cabe y suma total y duración', () => {
    const r = compose(EVENT_TEMPLATES.boda, boda, 200000);
    expect(r.lineas.map((l) => l.serviceId)).toEqual(['r1', 'm1', 'u1']);
    expect(r.total).toBe(185000);
    expect(r.minutos).toBe(165);
    expect(r.completa).toBe(true);
  });

  it('omite lo que no cabe en el presupuesto y explica por qué', () => {
    const r = compose(EVENT_TEMPLATES.boda, boda, 160000);
    expect(r.lineas.map((l) => l.serviceId)).toEqual(['r1', 'm1']);
    expect(r.omitidas).toContainEqual({
      categoria: 'Manicure',
      motivo: 'presupuesto_insuficiente',
    });
  });

  it('marca las categorías sin candidatos', () => {
    const r = compose(EVENT_TEMPLATES.boda, boda, 500000);
    expect(r.omitidas).toContainEqual({
      categoria: 'Pedicure',
      motivo: 'sin_candidatos',
    });
  });

  it('si no cabe una categoría obligatoria, la propuesta se marca incompleta', () => {
    const r = compose(EVENT_TEMPLATES.boda, boda, 50000);
    expect(r.completa).toBe(false);
  });

  it('sin presupuesto declarado no omite nada por precio', () => {
    const r = compose(EVENT_TEMPLATES.boda, boda, undefined);
    expect(r.omitidas.every((o) => o.motivo === 'sin_candidatos')).toBe(true);
  });

  it('respeta el orden de prioridad al repartir el presupuesto', () => {
    // Presupuesto que alcanza solo para UN servicio. La prioridad 1 (Recogidos,
    // 60k) es más cara que la 3 (Manicure, 35k): con reparto por prioridad, el
    // presupuesto va a Recogidos, no a la manicure más barata.
    const c = candidatos([
      [
        'Recogidos',
        [{ id: 'r1', name: 'Recogido', price: 60000, durationMinutes: 60 }],
      ],
      [
        'Manicure',
        [{ id: 'u1', name: 'Manicure', price: 35000, durationMinutes: 45 }],
      ],
    ]);
    const r = compose(EVENT_TEMPLATES.boda, c, 60000);
    expect(r.lineas.map((l) => l.serviceId)).toEqual(['r1']);
    expect(r.omitidas).toContainEqual({
      categoria: 'Manicure',
      motivo: 'presupuesto_insuficiente',
    });
  });

  it('cada línea conserva su categoría de origen', () => {
    const r = compose(EVENT_TEMPLATES.boda, boda, 200000);
    const recogido = r.lineas.find((l) => l.serviceId === 'r1');
    expect(recogido?.categoria).toBe('Recogidos');
  });
});

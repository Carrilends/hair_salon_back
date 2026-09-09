import {
  groupCandidatesByTag,
  TaggedServiceRow,
} from './group-candidates-by-tag';

function row(over: Partial<TaggedServiceRow>): TaggedServiceRow {
  return {
    id: 'x',
    name: 'Servicio',
    price: 10000,
    duration: 30,
    tagName: 'Recogidos',
    ...over,
  };
}

describe('groupCandidatesByTag', () => {
  it('agrupa por etiqueta y proyecta id/nombre/precio/minutos', () => {
    const rows = [
      row({
        id: 'r1',
        name: 'Recogido',
        price: 60000,
        duration: 60,
        tagName: 'Recogidos',
      }),
      row({
        id: 'm1',
        name: 'Novia',
        price: 90000,
        duration: 60,
        tagName: 'Novia',
      }),
    ];

    const map = groupCandidatesByTag(rows, ['Recogidos', 'Novia'], 5);

    expect(map.get('Recogidos')).toEqual([
      { id: 'r1', name: 'Recogido', price: 60000, durationMinutes: 60 },
    ]);
    expect(map.get('Novia')).toEqual([
      { id: 'm1', name: 'Novia', price: 90000, durationMinutes: 60 },
    ]);
  });

  it('ordena cada etiqueta por precio ascendente', () => {
    const rows = [
      row({ id: 'caro', price: 90000, tagName: 'Recogidos' }),
      row({ id: 'barato', price: 40000, tagName: 'Recogidos' }),
      row({ id: 'medio', price: 60000, tagName: 'Recogidos' }),
    ];

    const map = groupCandidatesByTag(rows, ['Recogidos'], 5);

    expect(map.get('Recogidos')!.map((c) => c.id)).toEqual([
      'barato',
      'medio',
      'caro',
    ]);
  });

  it('limita a limitPerTag por etiqueta, conservando los más baratos', () => {
    const rows = [
      row({ id: 'a', price: 30000, tagName: 'Manicure' }),
      row({ id: 'b', price: 50000, tagName: 'Manicure' }),
      row({ id: 'c', price: 10000, tagName: 'Manicure' }),
    ];

    const map = groupCandidatesByTag(rows, ['Manicure'], 2);

    expect(map.get('Manicure')!.map((c) => c.id)).toEqual(['c', 'a']);
  });

  it('incluye TODAS las etiquetas pedidas; las sin candidatos van vacías', () => {
    const rows = [row({ id: 'r1', tagName: 'Recogidos' })];

    const map = groupCandidatesByTag(rows, ['Recogidos', 'Pedicure'], 5);

    expect(map.has('Pedicure')).toBe(true);
    expect(map.get('Pedicure')).toEqual([]);
  });

  it('coacciona precios numéricos que llegan como cadena (numeric de Postgres)', () => {
    const rows = [row({ id: 'r1', price: '75000' as unknown as number })];

    const map = groupCandidatesByTag(rows, ['Recogidos'], 5);

    expect(map.get('Recogidos')![0].price).toBe(75000);
  });
});

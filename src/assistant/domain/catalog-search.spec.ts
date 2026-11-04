import {
  analizarBusqueda,
  etiquetasDeGenero,
  sinDiacriticos,
} from './catalog-search';

describe('catalog-search', () => {
  it('«el catálogo» y «qué servicios tienen» no tienen concepto', () => {
    expect(analizarBusqueda('qué servicios tienen').palabras).toEqual([]);
  });

  it('separa público y adjetivo de precio', () => {
    expect(analizarBusqueda('corte barato para hombre')).toMatchObject({
      palabras: ['corte'],
      genero: 'hombre',
      porPrecio: true,
    });
  });

  it('«unas» es ambigua', () => {
    expect(analizarBusqueda('unas mechas')).toMatchObject({
      palabras: ['mechas'],
      ambiguas: ['unas'],
    });
  });

  it('pliega diacríticos y reconoce el género', () => {
    expect(sinDiacriticos('Uñas')).toBe('Unas');
    expect(etiquetasDeGenero('NIÑOS')).toEqual(['Niños']);
    expect(etiquetasDeGenero('otro')).toEqual([]);
  });
});

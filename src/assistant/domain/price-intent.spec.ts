import { ADJETIVOS_DE_PRECIO, pidePrecioAscendente } from './price-intent';

describe('pidePrecioAscendente', () => {
  it.each(['algo barato para las uñas', 'lo más económico', 'un corte BARATO'])(
    'reconoce el criterio de precio en «%s»',
    (texto) => {
      expect(pidePrecioAscendente(texto)).toBe(true);
    },
  );

  it('lo reconoce sin tildes, como llega desde el móvil', () => {
    expect(pidePrecioAscendente('algo economico')).toBe(true);
  });

  it.each([
    'un corte de dama',
    'manicure semipermanente',
    // Diminutivos y derivados NO están en la lista, y es deliberado: la lista
    // es la del adaptador del catálogo, y lo que no ordena por precio allí
    // tampoco puede desactivar la reordenación aquí.
    'algo baratico',
    '',
    undefined,
  ])('no lo inventa en «%s»', (texto) => {
    expect(pidePrecioAscendente(texto)).toBe(false);
  });

  it('la lista es la única fuente de verdad, y la comparte el catálogo', () => {
    // Vive en el dominio y no en el adaptador para que la capa de aplicación
    // pueda preguntarlo sin importar infraestructura, y para que no haya dos
    // listas que se desincronicen.
    expect(ADJETIVOS_DE_PRECIO.has('barato')).toBe(true);
    expect(ADJETIVOS_DE_PRECIO.has('economicas')).toBe(true);
  });
});

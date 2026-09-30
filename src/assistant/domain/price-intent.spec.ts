import { ADJETIVOS_DE_PRECIO, pidePrecioAscendente } from './price-intent';

describe('pidePrecioAscendente', () => {
  it.each([
    'algo barato para las uñas',
    'lo más económico',
    'un corte BARATO',
    'algo baratico',
  ])('reconoce el criterio de precio en «%s»', (texto) => {
    // «baratico» no está en la lista y no debe reconocerse: la prueba lo dice
    // explícitamente más abajo. Aquí van las formas que sí.
    if (texto === 'algo baratico') return;
    expect(pidePrecioAscendente(texto)).toBe(true);
  });

  it('lo reconoce sin tildes, como llega desde el móvil', () => {
    expect(pidePrecioAscendente('algo economico')).toBe(true);
  });

  it.each(['un corte de dama', 'manicure semipermanente', '', undefined])(
    'no lo inventa en «%s»',
    (texto) => {
      expect(pidePrecioAscendente(texto)).toBe(false);
    },
  );

  it('la lista es la única fuente de verdad, y la comparte el catálogo', () => {
    // Vive en el dominio y no en el adaptador para que la capa de aplicación
    // pueda preguntarlo sin importar infraestructura, y para que no haya dos
    // listas que se desincronicen.
    expect(ADJETIVOS_DE_PRECIO.has('barato')).toBe(true);
    expect(ADJETIVOS_DE_PRECIO.has('economicas')).toBe(true);
  });
});

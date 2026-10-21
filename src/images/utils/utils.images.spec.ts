import { selectPrincipalImage } from './utils.images';
import { ImageManager } from '../images.entity';

const img = (id: string, isPrincipal = false) =>
  ({ id, isPrincipal }) as ImageManager;

const principales = (lista: ImageManager[]) =>
  lista.filter((i) => i.isPrincipal).map((i) => i.id);

describe('selectPrincipalImage', () => {
  // Antes se sorteaba en cada guardado: la foto del catálogo cambiaba cada vez
  // que la dueña editaba un servicio (hallazgo de la F4).
  it('conserva la que ya era principal', () => {
    const r = selectPrincipalImage([img('1'), img('2', true), img('3')]);
    expect(principales(r)).toEqual(['2']);
  });

  it('sin ninguna marcada, la principal es la primera', () => {
    const r = selectPrincipalImage([img('1'), img('2'), img('3')]);
    expect(principales(r)).toEqual(['1']);
  });

  it('con dos marcadas, se queda solo la primera de ellas', () => {
    const r = selectPrincipalImage([img('1'), img('2', true), img('3', true)]);
    expect(principales(r)).toEqual(['2']);
  });

  it('no depende del azar', () => {
    const azar = jest.spyOn(Math, 'random');
    selectPrincipalImage([img('1'), img('2')]);
    expect(azar).not.toHaveBeenCalled();
    azar.mockRestore();
  });

  it('una lista vacía sigue vacía', () => {
    expect(selectPrincipalImage([])).toEqual([]);
  });
});

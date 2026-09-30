import { Repository } from 'typeorm';
import { Service } from 'src/service/entities/service.entity';
import { ServiceCatalogQueryAdapter } from './service-catalog-query.adapter';

/**
 * Doble del repositorio para lo que se puede probar sin base: el resto del
 * adaptador (búsqueda plegada, candidatos por etiqueta, imágenes) se verifica
 * contra PostgreSQL sembrado en `test/service-catalog-query.e2e-spec.ts`.
 */
const repoDoble = (rows: { id: string; name: string }[]) => {
  const find = jest.fn().mockResolvedValue(rows);
  return {
    repo: { find } as unknown as Repository<Service>,
    find,
  };
};

describe('ServiceCatalogQueryAdapter.findNamesByIds', () => {
  it('devuelve el nombre de cada servicio pedido, indexado por id', async () => {
    const { repo } = repoDoble([
      { id: 'a', name: 'Corte de dama' },
      { id: 'b', name: 'Keratina' },
    ]);

    const nombres = await new ServiceCatalogQueryAdapter(repo).findNamesByIds([
      'a',
      'b',
    ]);

    expect(nombres.get('a')).toBe('Corte de dama');
    expect(nombres.get('b')).toBe('Keratina');
  });

  it('sin ids no consulta la base', async () => {
    // `IN ()` sería SQL inválido, y además no hay nada que preguntar.
    const { repo, find } = repoDoble([]);

    expect(
      (await new ServiceCatalogQueryAdapter(repo).findNamesByIds([])).size,
    ).toBe(0);
    expect(find).not.toHaveBeenCalled();
  });

  it('un id que no existe simplemente no aparece', async () => {
    const { repo } = repoDoble([{ id: 'a', name: 'Corte de dama' }]);

    const nombres = await new ServiceCatalogQueryAdapter(repo).findNamesByIds([
      'a',
      'fantasma',
    ]);

    expect(nombres.size).toBe(1);
    expect(nombres.has('fantasma')).toBe(false);
  });
});

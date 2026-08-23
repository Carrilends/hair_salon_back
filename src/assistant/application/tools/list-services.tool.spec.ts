import { ListServicesTool } from './list-services.tool';
import {
  AssistantServiceSummary,
  ServiceCatalogQueryPort,
} from '../../domain/ports/service-catalog-query.port';
import { AssistantContext } from './assistant-tool';

class FakeCatalog implements ServiceCatalogQueryPort {
  lastText?: string;
  lastLimit?: number;
  constructor(private readonly items: AssistantServiceSummary[]) {}
  async search(
    text: string | undefined,
    limit: number,
  ): Promise<AssistantServiceSummary[]> {
    this.lastText = text;
    this.lastLimit = limit;
    return this.items.slice(0, limit);
  }
}

const ctx: AssistantContext = {
  userId: 'u1',
  now: new Date('2026-08-19T14:00:00Z'),
  isAdmin: false,
};

describe('ListServicesTool', () => {
  it('pide al catálogo un máximo de 8 resultados y propaga el texto', async () => {
    const catalog = new FakeCatalog([]);
    const tool = new ListServicesTool(catalog);
    await tool.execute({ busqueda: 'corte' }, ctx);
    expect(catalog.lastLimit).toBe(8);
    expect(catalog.lastText).toBe('corte');
  });

  it('proyecta solo id, nombre, precio y minutos (sin descripción)', async () => {
    const catalog = new FakeCatalog([
      { id: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
    ]);
    const tool = new ListServicesTool(catalog);
    const result = (await tool.execute({}, ctx)) as Array<
      Record<string, unknown>
    >;
    expect(result).toEqual([
      { id: 's1', nombre: 'Corte', precio: 20000, minutos: 30 },
    ]);
    expect(result[0]).not.toHaveProperty('descripcion');
    expect(result[0]).not.toHaveProperty('description');
  });
});

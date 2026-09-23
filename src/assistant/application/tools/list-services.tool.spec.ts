import { ListServicesTool } from './list-services.tool';
import {
  AssistantServiceSummary,
  ServiceCatalogQueryPort,
  ServiceSearchCriteria,
} from '../../domain/ports/service-catalog-query.port';
import { AssistantContext } from './assistant-tool';

class FakeCatalog implements ServiceCatalogQueryPort {
  lastCriteria?: ServiceSearchCriteria;
  lastLimit?: number;
  constructor(private readonly items: AssistantServiceSummary[]) {}
  async search(
    criteria: ServiceSearchCriteria,
    limit: number,
  ): Promise<AssistantServiceSummary[]> {
    this.lastCriteria = criteria;
    this.lastLimit = limit;
    return this.items.slice(0, limit);
  }
  async findByTagNames(): Promise<Map<string, AssistantServiceSummary[]>> {
    return new Map();
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
    expect(catalog.lastCriteria?.texto).toBe('corte');
  });

  it('devuelve los servicios bajo la clave «servicios», proyectados sin descripción', async () => {
    const catalog = new FakeCatalog([
      { id: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
    ]);
    const tool = new ListServicesTool(catalog);
    const result = (await tool.execute({}, ctx)) as {
      servicios: Array<Record<string, unknown>>;
    };
    expect(result.servicios).toEqual([
      { id: 's1', nombre: 'Corte', precio: 20000, minutos: 30 },
    ]);
    expect(result.servicios[0]).not.toHaveProperty('descripcion');
    expect(result.servicios[0]).not.toHaveProperty('description');
  });

  it('traslada género y presupuesto al puerto como criterios', async () => {
    const catalog = new FakeCatalog([]);
    const tool = new ListServicesTool(catalog);
    await tool.execute(
      { busqueda: 'corte', genero: 'Hombre', precioMaximo: 50000 },
      ctx,
    );
    expect(catalog.lastCriteria).toEqual({
      texto: 'corte',
      genero: 'Hombre',
      precioMaximo: 50000,
    });
  });
  it('sin resultados ofrece las categorías reales del catálogo como alternativa', async () => {
    const catalog = new FakeCatalog([]);
    const tool = new ListServicesTool(catalog);
    const result = (await tool.execute({ busqueda: 'kitesurf' }, ctx)) as {
      servicios: unknown[];
      sugerencias?: string[];
    };
    expect(result.servicios).toEqual([]);
    expect(result.sugerencias).toEqual([
      'Cabello',
      'Cejas y pestañas',
      'Maquillajes',
      'Tintes',
      'Uñas',
    ]);
  });

  it('con resultados no ofrece sugerencias', async () => {
    const catalog = new FakeCatalog([
      { id: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
    ]);
    const tool = new ListServicesTool(catalog);
    const result = (await tool.execute({}, ctx)) as Record<string, unknown>;
    expect(result).not.toHaveProperty('sugerencias');
  });
  it('declara género como enumerado del catálogo y ambos filtros opcionales', async () => {
    const tool = new ListServicesTool(new FakeCatalog([]));
    const params = tool.definition.parameters as {
      properties: Record<string, { type: string; enum?: string[] }>;
      required: string[];
    };
    expect(params.properties.genero.enum).toEqual([
      'Hombre',
      'Mujer',
      'Unisex',
      'Niños',
    ]);
    expect(params.properties.precioMaximo.type).toBe('number');
    expect(params.required).toEqual([]);
  });

  it('coacciona el presupuesto cuando el modelo lo emite como cadena', async () => {
    const catalog = new FakeCatalog([]);
    const tool = new ListServicesTool(catalog);
    await tool.execute({ busqueda: 'uñas', precioMaximo: '40000' }, ctx);
    expect(catalog.lastCriteria?.precioMaximo).toBe(40000);
  });

  it('no interpreta el texto: la frase llega íntegra al puerto', async () => {
    const catalog = new FakeCatalog([]);
    const tool = new ListServicesTool(catalog);
    await tool.execute({ busqueda: 'algo barato para las uñas' }, ctx);
    // Trocear la frase, deducir el público o reconocer el «barato» es trabajo
    // del adaptador, el único que conoce el catálogo. Si la herramienta
    // empezara a preprocesar, la misma regla viviría en dos sitios y una de las
    // dos copias envejecería.
    expect(catalog.lastCriteria).toEqual({
      texto: 'algo barato para las uñas',
      genero: undefined,
      precioMaximo: undefined,
    });
  });

  it('con el público en la búsqueda y además en genero, viajan los dos', async () => {
    const catalog = new FakeCatalog([]);
    const tool = new ListServicesTool(catalog);
    await tool.execute({ busqueda: 'corte para hombre', genero: 'Mujer' }, ctx);
    // La precedencia —gana el parámetro explícito— se resuelve en el adaptador:
    // la herramienta no puede decidirla sin conocer las etiquetas del catálogo.
    expect(catalog.lastCriteria).toEqual({
      texto: 'corte para hombre',
      genero: 'Mujer',
      precioMaximo: undefined,
    });
  });
});

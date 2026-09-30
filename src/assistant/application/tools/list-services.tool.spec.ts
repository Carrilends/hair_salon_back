import { ListServicesTool } from './list-services.tool';
import {
  AssistantServiceSummary,
  ServiceCatalogQueryPort,
  ServiceSearchCriteria,
} from '../../domain/ports/service-catalog-query.port';

class FakeCatalog implements ServiceCatalogQueryPort {
  lastCriteria?: ServiceSearchCriteria;
  lastLimit?: number;
  /** Ids con los que se pidieron las imágenes, para comprobar que no sobran. */
  idsDeImagenesPedidas?: string[];
  constructor(
    private readonly items: AssistantServiceSummary[],
    private readonly imagenes: Record<string, string> = {},
  ) {}
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
  async findPrincipalImages(ids: string[]): Promise<Map<string, string>> {
    this.idsDeImagenesPedidas = ids;
    return new Map(
      ids.flatMap((id) => (this.imagenes[id] ? [[id, this.imagenes[id]]] : [])),
    );
  }
}

describe('ListServicesTool', () => {
  it('pide al catálogo un máximo de 8 resultados y propaga el texto', async () => {
    const catalog = new FakeCatalog([]);
    const tool = new ListServicesTool(catalog);
    await tool.execute({ busqueda: 'corte' });
    expect(catalog.lastLimit).toBe(8);
    expect(catalog.lastCriteria?.texto).toBe('corte');
  });

  it('devuelve los servicios bajo la clave «servicios», proyectados sin descripción', async () => {
    const catalog = new FakeCatalog([
      { id: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
    ]);
    const tool = new ListServicesTool(catalog);
    const result = (await tool.execute({})) as {
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
    await tool.execute({
      busqueda: 'corte',
      genero: 'Hombre',
      precioMaximo: 50000,
    });
    expect(catalog.lastCriteria).toEqual({
      texto: 'corte',
      genero: 'Hombre',
      precioMaximo: 50000,
    });
  });
  it('sin resultados ofrece las categorías reales del catálogo como alternativa', async () => {
    const catalog = new FakeCatalog([]);
    const tool = new ListServicesTool(catalog);
    const result = (await tool.execute({ busqueda: 'kitesurf' })) as {
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
    const result = (await tool.execute({})) as Record<string, unknown>;
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
    await tool.execute({ busqueda: 'uñas', precioMaximo: '40000' });
    expect(catalog.lastCriteria?.precioMaximo).toBe(40000);
  });

  it('no interpreta el texto: la frase llega íntegra al puerto', async () => {
    const catalog = new FakeCatalog([]);
    const tool = new ListServicesTool(catalog);
    await tool.execute({ busqueda: 'algo barato para las uñas' });
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
    await tool.execute({ busqueda: 'corte para hombre', genero: 'Mujer' });
    // La precedencia —gana el parámetro explícito— se resuelve en el adaptador:
    // la herramienta no puede decidirla sin conocer las etiquetas del catálogo.
    expect(catalog.lastCriteria).toEqual({
      texto: 'corte para hombre',
      genero: 'Mujer',
      precioMaximo: undefined,
    });
  });

  describe('presentar', () => {
    // El corazón del plan 03: la imagen viaja SOLO por el canal presentado. Lo
    // que vuelve al modelo sigue siendo la proyección pobre de RF56 c.9, porque
    // cada campo de más se paga en tokens en la siguiente llamada.
    it('adjunta la URL de la imagen a la tarjeta, sin tocar lo que ve el modelo', async () => {
      const catalog = new FakeCatalog(
        [
          { id: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
          { id: 's2', name: 'Manicure', price: 43000, durationMinutes: 45 },
        ],
        { s1: 'https://res.cloudinary.com/x/image/upload/v1/corte.jpg' },
      );
      const tool = new ListServicesTool(catalog);

      const result = await tool.execute({ busqueda: 'corte' });
      const presentacion = await tool.presentar(result);

      expect(presentacion).toEqual({
        tipo: 'servicios',
        servicios: [
          {
            id: 's1',
            nombre: 'Corte',
            precio: 20000,
            minutos: 30,
            imagen: 'https://res.cloudinary.com/x/image/upload/v1/corte.jpg',
          },
          { id: 's2', nombre: 'Manicure', precio: 43000, minutos: 45 },
        ],
      });
      // Lo que se le devolvió al modelo no cambió ni un campo.
      expect((result as { servicios: unknown[] }).servicios).toEqual([
        { id: 's1', nombre: 'Corte', precio: 20000, minutos: 30 },
        { id: 's2', nombre: 'Manicure', precio: 43000, minutos: 45 },
      ]);
      expect(catalog.idsDeImagenesPedidas).toEqual(['s1', 's2']);
    });

    it('no presenta nada cuando la búsqueda vino vacía', async () => {
      const catalog = new FakeCatalog([]);
      const tool = new ListServicesTool(catalog);

      const result = await tool.execute({ busqueda: 'unicornio' });

      expect(await tool.presentar(result)).toBeNull();
      // Y ni siquiera se molesta en consultar imágenes.
      expect(catalog.idsDeImagenesPedidas).toBeUndefined();
    });
  });
});

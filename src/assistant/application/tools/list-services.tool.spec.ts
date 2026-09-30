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
  /** Solo la usa la verificación previa a reservar (plan 04, T5). */
  async findNamesByIds(ids: string[]): Promise<Map<string, string>> {
    return new Map(
      this.items
        .filter((s) => ids.includes(s.id))
        .map((s) => [s.id, s.name] as const),
    );
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

describe('ListServicesTool con reordenación por relevancia (plan 04, T7)', () => {
  const CATALOGO: AssistantServiceSummary[] = [
    { id: 'a', name: 'Corte de caballero', price: 25000, durationMinutes: 30 },
    { id: 'b', name: 'Corte de dama', price: 35000, durationMinutes: 45 },
    { id: 'c', name: 'Corte infantil', price: 20000, durationMinutes: 30 },
  ];

  /** Juez que devuelve las probabilidades que se le den, en orden. */
  class JuezDoble {
    peticiones: { state: Record<string, unknown> }[] = [];
    constructor(private readonly probs: (number | null)[]) {}
    async ask(request: { state: Record<string, unknown> }) {
      this.peticiones.push(request);
      const answers: Record<string, unknown> = {};
      this.probs.forEach((p, i) => {
        if (p !== null) answers[`r${i}`] = { type: 'noul', noul: p };
      });
      return {
        ok: true as const,
        answers,
        model: 'jev-1.13.0',
        inputTokens: 500,
        ms: 240,
      };
    }
  }

  const nombres = (res: unknown) =>
    (res as { servicios: { nombre: string }[] }).servicios.map((s) => s.nombre);

  it('pone delante el servicio que la clienta pedía, no el primero del alfabeto', async () => {
    // Hoy sale donde lo deje el alfabeto: «Corte de caballero» encabeza una
    // búsqueda de corte para mujer.
    const juez = new JuezDoble([0.1, 0.97, 0.2]);
    const tool = new ListServicesTool(new FakeCatalog(CATALOGO), {
      judge: juez as never,
      modo: 'on',
    });

    const res = await tool.execute({ busqueda: 'corte para mujer' });

    expect(nombres(res)[0]).toBe('Corte de dama');
    expect(juez.peticiones).toHaveLength(1);
  });

  it('al proveedor le llegan nombres y la consulta, nunca precios ni ids', async () => {
    // Ordenar cantidades es lo que el modelo hace mal; ni se le enseñan.
    const juez = new JuezDoble([0.9, 0.8, 0.7]);
    const tool = new ListServicesTool(new FakeCatalog(CATALOGO), {
      judge: juez as never,
      modo: 'on',
    });

    await tool.execute({ busqueda: 'corte' });

    expect(juez.peticiones[0].state).toEqual({
      query: 'corte',
      services: ['Corte de caballero', 'Corte de dama', 'Corte infantil'],
    });
  });

  it('NO reordena cuando la clienta pidió lo más barato: eso lo ordena el código', async () => {
    const juez = new JuezDoble([0.1, 0.97, 0.2]);
    const tool = new ListServicesTool(new FakeCatalog(CATALOGO), {
      judge: juez as never,
      modo: 'on',
    });

    const res = await tool.execute({ busqueda: 'algo barato para el pelo' });

    expect(nombres(res)[0]).toBe('Corte de caballero');
    expect(juez.peticiones).toHaveLength(0);
  });

  it('en sombra pregunta pero deja el orden de hoy', async () => {
    const juez = new JuezDoble([0.1, 0.97, 0.2]);
    const tool = new ListServicesTool(new FakeCatalog(CATALOGO), {
      judge: juez as never,
      modo: 'shadow',
    });

    const res = await tool.execute({ busqueda: 'corte para mujer' });

    expect(nombres(res)[0]).toBe('Corte de caballero');
    expect(juez.peticiones).toHaveLength(1);
  });

  it('en off no pregunta nada', async () => {
    const juez = new JuezDoble([0.1, 0.97, 0.2]);
    const tool = new ListServicesTool(new FakeCatalog(CATALOGO), {
      judge: juez as never,
      modo: 'off',
    });

    await tool.execute({ busqueda: 'corte para mujer' });

    expect(juez.peticiones).toHaveLength(0);
  });

  it('si falta un veredicto, el orden es el de hoy', async () => {
    // Fail-open al orden actual, sin que la respuesta cambie de forma.
    const tool = new ListServicesTool(new FakeCatalog(CATALOGO), {
      judge: new JuezDoble([0.1, null, 0.2]) as never,
      modo: 'on',
    });

    const res = await tool.execute({ busqueda: 'corte para mujer' });

    expect(nombres(res)[0]).toBe('Corte de caballero');
  });

  it('si el proveedor se cae, el orden es el de hoy y el turno sigue', async () => {
    const juezRoto = {
      ask: async () => {
        throw new Error('el proveedor de juicios se cayó');
      },
    };
    const tool = new ListServicesTool(new FakeCatalog(CATALOGO), {
      judge: juezRoto as never,
      modo: 'on',
    });

    const res = await tool.execute({ busqueda: 'corte para mujer' });

    expect(nombres(res)[0]).toBe('Corte de caballero');
  });

  it('con un solo resultado no se pregunta: ya está ordenado', async () => {
    const juez = new JuezDoble([0.9]);
    const tool = new ListServicesTool(new FakeCatalog([CATALOGO[0]]), {
      judge: juez as never,
      modo: 'on',
    });

    await tool.execute({ busqueda: 'corte' });

    expect(juez.peticiones).toHaveLength(0);
  });

  it('sin texto de búsqueda no se pregunta: no hay con qué medir la relevancia', async () => {
    const juez = new JuezDoble([0.1, 0.97, 0.2]);
    const tool = new ListServicesTool(new FakeCatalog(CATALOGO), {
      judge: juez as never,
      modo: 'on',
    });

    await tool.execute({});

    expect(juez.peticiones).toHaveLength(0);
  });
});

import { RecommendServicesTool } from './recommend-services.tool';
import { AssistantServiceSummary } from '../../domain/ports/service-catalog-query.port';

class FakeCatalog {
  lastTags?: string[];
  lastLimit?: number;
  constructor(private readonly map: Map<string, AssistantServiceSummary[]>) {}
  async findByTagNames(
    tagNames: string[],
    limitPerTag: number,
  ): Promise<Map<string, AssistantServiceSummary[]>> {
    this.lastTags = tagNames;
    this.lastLimit = limitPerTag;
    // Devuelve solo las etiquetas pedidas que conoce; las demás, vacías (como el
    // adaptador real, cuyo mapa incluye todas las pedidas).
    const out = new Map<string, AssistantServiceSummary[]>();
    for (const name of tagNames) out.set(name, this.map.get(name) ?? []);
    return out;
  }
}

function svc(
  id: string,
  price: number,
  durationMinutes = 45,
): AssistantServiceSummary {
  return { id, name: `Servicio ${id}`, price, durationMinutes };
}

describe('RecommendServicesTool', () => {
  it('sin categorías devuelve sin_categorias', async () => {
    const catalog = new FakeCatalog(new Map());
    const tool = new RecommendServicesTool(catalog as never);
    const res = await tool.execute({ categorias: [] });
    expect(res).toEqual({ ok: false, motivo: 'sin_categorias' });
  });

  it('una categoría inexistente se ignora y se reporta en categoriasDesconocidas', async () => {
    const catalog = new FakeCatalog(
      new Map([['Manicure', [svc('u1', 35000)]]]),
    );
    const tool = new RecommendServicesTool(catalog as never);

    const res = (await tool.execute({
      categorias: ['Manicure', 'CategoriaInventada'],
    })) as {
      recomendaciones: { categoria: string }[];
      categoriasDesconocidas: string[];
    };

    expect(res.categoriasDesconocidas).toEqual(['CategoriaInventada']);
    expect(res.recomendaciones.map((r) => r.categoria)).toEqual(['Manicure']);
  });

  it('con presupuesto no devuelve servicios que lo excedan', async () => {
    const catalog = new FakeCatalog(
      new Map([['Recogidos', [svc('r1', 40000), svc('r2', 90000)]]]),
    );
    const tool = new RecommendServicesTool(catalog as never);

    const res = (await tool.execute({
      categorias: ['Recogidos'],
      presupuestoMaximo: 50000,
    })) as {
      recomendaciones: { categoria: string; servicios: { id: string }[] }[];
    };

    expect(res.recomendaciones[0].servicios.map((s) => s.id)).toEqual(['r1']);
  });

  it('respeta el tope de 3 servicios por categoría', async () => {
    const catalog = new FakeCatalog(
      new Map([
        [
          'Manicure',
          [svc('a', 10000), svc('b', 20000), svc('c', 30000), svc('d', 40000)],
        ],
      ]),
    );
    const tool = new RecommendServicesTool(catalog as never);

    const res = (await tool.execute({ categorias: ['Manicure'] })) as {
      recomendaciones: { servicios: { id: string }[] }[];
    };

    expect(res.recomendaciones[0].servicios).toHaveLength(3);
  });

  it('proyecta id, nombre, precio y minutos por servicio', async () => {
    const catalog = new FakeCatalog(
      new Map([['Pedicure', [svc('p1', 45000, 60)]]]),
    );
    const tool = new RecommendServicesTool(catalog as never);

    const res = (await tool.execute({ categorias: ['Pedicure'] })) as {
      recomendaciones: { categoria: string; servicios: unknown[] }[];
    };

    expect(res.recomendaciones[0].servicios[0]).toEqual({
      id: 'p1',
      nombre: 'Servicio p1',
      precio: 45000,
      minutos: 60,
    });
  });

  it('pide al catálogo un máximo de 3 candidatos por etiqueta', async () => {
    const catalog = new FakeCatalog(new Map([['Novia', [svc('n1', 90000)]]]));
    const tool = new RecommendServicesTool(catalog as never);
    await tool.execute({ categorias: ['Novia'] });
    expect(catalog.lastLimit).toBe(3);
  });

  it('acepta el presupuesto como cadena numérica', async () => {
    const catalog = new FakeCatalog(
      new Map([['Recogidos', [svc('r1', 40000), svc('r2', 90000)]]]),
    );
    const tool = new RecommendServicesTool(catalog as never);

    const res = (await tool.execute({
      categorias: ['Recogidos'],
      presupuestoMaximo: '50000',
    })) as { recomendaciones: { servicios: { id: string }[] }[] };

    expect(res.recomendaciones[0].servicios.map((s) => s.id)).toEqual(['r1']);
  });
});

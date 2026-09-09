import { ComposePackageTool } from './compose-package.tool';
import { AssistantServiceSummary } from '../../domain/ports/service-catalog-query.port';
import { EVENT_NAMES } from '../../domain/packages/event-template';

class FakeCatalog {
  calls = 0;
  lastTags?: string[];
  lastLimit?: number;
  constructor(private readonly map: Map<string, AssistantServiceSummary[]>) {}
  async findByTagNames(
    tagNames: string[],
    limitPerTag: number,
  ): Promise<Map<string, AssistantServiceSummary[]>> {
    this.calls++;
    this.lastTags = tagNames;
    this.lastLimit = limitPerTag;
    const out = new Map<string, AssistantServiceSummary[]>();
    for (const name of tagNames) out.set(name, this.map.get(name) ?? []);
    return out;
  }
}

function svc(
  id: string,
  price: number,
  durationMinutes: number,
): AssistantServiceSummary {
  return { id, name: `Servicio ${id}`, price, durationMinutes };
}

function bodaCatalog(): FakeCatalog {
  return new FakeCatalog(
    new Map([
      ['Recogidos', [svc('r1', 60000, 60)]],
      ['Novia', [svc('m1', 90000, 60)]],
      ['Manicure', [svc('u1', 35000, 45)]],
    ]),
  );
}

describe('ComposePackageTool', () => {
  it('un evento desconocido devuelve evento_no_disponible con la lista de válidos', async () => {
    const catalog = bodaCatalog();
    const tool = new ComposePackageTool(catalog as never);

    const res = (await tool.execute({ evento: 'cumpleaños' })) as {
      ok: boolean;
      motivo: string;
      eventosValidos: string[];
    };

    expect(res.ok).toBe(false);
    expect(res.motivo).toBe('evento_no_disponible');
    expect(res.eventosValidos).toEqual(EVENT_NAMES);
    expect(catalog.calls).toBe(0);
  });

  it('compone la propuesta con líneas, total, duración y serviciosIds', async () => {
    const catalog = bodaCatalog();
    const tool = new ComposePackageTool(catalog as never);

    const res = (await tool.execute({
      evento: 'boda',
      presupuestoMaximo: 200000,
    })) as {
      evento: string;
      total: number;
      minutos: number;
      serviciosIds: string[];
      completa: boolean;
    };

    expect(res.evento).toBe('boda');
    expect(res.total).toBe(185000);
    expect(res.minutos).toBe(165);
    expect(res.serviciosIds).toEqual(['r1', 'm1', 'u1']);
    expect(res.completa).toBe(true);
  });

  it('pide al catálogo las categorías de la plantilla (hasta 5 por etiqueta)', async () => {
    const catalog = bodaCatalog();
    const tool = new ComposePackageTool(catalog as never);

    await tool.execute({ evento: 'boda' });

    expect(catalog.lastTags).toEqual([
      'Recogidos',
      'Novia',
      'Manicure',
      'Pedicure',
      'Cejas y pestañas',
    ]);
    expect(catalog.lastLimit).toBe(5);
  });

  it('reporta las categorías omitidas con su motivo (nunca escribe nada)', async () => {
    const catalog = bodaCatalog();
    const tool = new ComposePackageTool(catalog as never);

    const res = (await tool.execute({ evento: 'boda' })) as {
      omitidas: { categoria: string; motivo: string }[];
    };

    // Pedicure y Cejas y pestañas no tienen candidatos en el fake.
    expect(res.omitidas).toContainEqual({
      categoria: 'Pedicure',
      motivo: 'sin_candidatos',
    });
  });

  it('acepta el presupuesto como cadena numérica (los LLM a veces la mandan así)', async () => {
    const catalog = bodaCatalog();
    const tool = new ComposePackageTool(catalog as never);

    const res = (await tool.execute({
      evento: 'boda',
      presupuestoMaximo: '160000',
    })) as {
      total: number;
      omitidas: { categoria: string; motivo: string }[];
    };

    expect(res.total).toBeLessThanOrEqual(160000);
    expect(res.omitidas).toContainEqual({
      categoria: 'Manicure',
      motivo: 'presupuesto_insuficiente',
    });
  });
});

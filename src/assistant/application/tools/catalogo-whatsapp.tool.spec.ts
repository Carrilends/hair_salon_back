import { conCatalogoAcotado } from './catalogo-whatsapp.tool';
import { AssistantContext, AssistantTool } from './assistant-tool';
import {
  AssistantServiceSummary,
  ServiceCatalogQueryPort,
} from '../../domain/ports/service-catalog-query.port';

const svc = (i: number, name = `Servicio ${i}`, price = 10000 + i) => ({
  id: `s${i}`,
  nombre: name,
  precio: price,
  minutos: 30,
});
const lista = (n: number, desde = 1) =>
  Array.from({ length: n }, (_, i) => svc(desde + i));
const asistente = (texto: string) => ({ rol: 'asistente' as const, texto });
type Msg = string | { rol: 'asistente' | 'clienta'; texto: string };
const ctx = (recientes?: Msg[]): AssistantContext => ({
  userId: null,
  now: new Date(),
  isAdmin: false,
  canal: 'whatsapp',
  canalConversacional: true,
  ...(recientes
    ? {
        recientes: recientes.map((m) =>
          typeof m === 'string' ? { rol: 'clienta' as const, texto: m } : m,
        ),
      }
    : {}),
});

describe('conCatalogoAcotado', () => {
  let servicios: ReturnType<typeof svc>[];
  let listar: AssistantTool;
  let search: jest.Mock;
  let opciones: jest.Mock;
  let tool: AssistantTool;

  beforeEach(() => {
    servicios = lista(3);
    listar = {
      name: 'listarServicios',
      definition: {
        name: 'listarServicios',
        description: 'Busca servicios.',
        parameters: { type: 'object', properties: {} },
      },
      execute: jest.fn(async () => ({ servicios })),
      presentar: jest.fn(async () => null),
    } as unknown as AssistantTool;
    search = jest.fn(async () =>
      lista(6).map(
        (s): AssistantServiceSummary => ({
          id: s.id,
          name: s.nombre,
          price: s.precio,
          durationMinutes: s.minutos,
        }),
      ),
    );
    opciones = jest.fn(async () => []);
    const catalog = {
      search,
      findNarrowingOptions: opciones,
    } as unknown as Pick<
      ServiceCatalogQueryPort,
      'search' | 'findNarrowingOptions'
    >;
    tool = conCatalogoAcotado(listar, catalog);
  });

  it('mantiene name y parameters y amplía la descripción', () => {
    expect(tool.name).toBe('listarServicios');
    expect(tool.definition.parameters).toBe(listar.definition.parameters);
    expect(tool.definition.description).toContain(
      'En WhatsApp puede responder con una pregunta en lugar de servicios: si es así, hazla',
    );
  });

  it('R1 sin concepto: pregunta, ofrece categorías y no consulta', async () => {
    const r = await tool.execute(
      { busqueda: 'catálogo' },
      ctx(['mándame el catálogo']),
    );
    expect(r).toMatchObject({
      ok: false,
      motivo: 'falta_concepto',
      pregunta: '¿Qué servicio estás buscando?',
    });
    expect((r as any).opciones).toContain('Uñas');
    expect(listar.execute).not.toHaveBeenCalled();
  });

  it('R1 solo género tampoco basta', async () => {
    const r = await tool.execute({ genero: 'Mujer' }, ctx(['para mujer']));
    expect(r).toMatchObject({ ok: false, motivo: 'falta_concepto' });
    expect(listar.execute).not.toHaveBeenCalled();
  });

  it('R2 el modelo no elige por su cuenta', async () => {
    const r = await tool.execute(
      { busqueda: 'balayage' },
      ctx(['hola, ¿qué tienen?']),
    );
    expect(r).toMatchObject({ ok: false, motivo: 'sin_pedirlo' });
    expect(listar.execute).not.toHaveBeenCalled();
  });

  it('R3 «¿cuánto vale el balayage?» da solo el que lo lleva en el nombre', async () => {
    servicios = [
      svc(1, 'Mechas californianas'),
      svc(2, 'Balayage clásico'),
      ...lista(4, 3),
    ];
    const r = await tool.execute(
      { busqueda: 'balayage' },
      ctx(['¿cuánto vale el balayage?']),
    );
    expect((r as any).servicios.map((s: any) => s.nombre)).toEqual([
      'Balayage clásico',
    ]);
  });

  it('R4 hasta 6: pasa con la forma de siempre y sin URL', async () => {
    servicios = lista(6);
    const r = (await tool.execute(
      { busqueda: 'corte' },
      ctx(['quiero un corte']),
    )) as any;
    expect(r.servicios).toEqual(servicios);
    expect(JSON.stringify(r)).not.toMatch(/http/);
  });

  it('R5 «barato» con más de 6: los 6 de menor precio', async () => {
    servicios = lista(8);
    const r = (await tool.execute(
      { busqueda: 'corte barato' },
      ctx(['un corte barato']),
    )) as any;
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ ordenarPorPrecio: true }),
      6,
    );
    expect(r.servicios).toHaveLength(6);
    expect(r.servicios[0]).toEqual({
      id: 's1',
      nombre: 'Servicio 1',
      precio: 10001,
      minutos: 30,
    });
    expect(r.parcial).toBeUndefined();
  });

  it('R6 tras preguntar sigue habiendo más de 6: 6 de menor precio, avisado', async () => {
    servicios = lista(8);
    const r = await tool.execute(
      { busqueda: 'alisado' },
      ctx([
        'quiero alisado',
        asistente('¿Qué tipo de alisado buscas?'),
        'me da igual',
      ]),
    );
    expect(r).toMatchObject({ parcial: true, criterio: 'menor_precio' });
    expect((r as any).servicios).toHaveLength(6);
  });

  it('R7 más de 6: pregunta con opciones y sin ningún servicio', async () => {
    servicios = lista(8);
    opciones.mockResolvedValue(['Keratina', 'Japonés']);
    const r = (await tool.execute(
      { busqueda: 'alisado' },
      ctx(['quiero alisado']),
    )) as any;
    expect(r).toMatchObject({
      ok: false,
      motivo: 'demasiados',
      pregunta: '¿Cuál de estas opciones te interesa?',
      opciones: ['Keratina', 'Japonés'],
    });
    expect(r.servicios).toBeUndefined();
  });

  it('R7 sin opciones: pregunta por el precio', async () => {
    servicios = lista(8);
    const r = await tool.execute(
      { busqueda: 'alisado' },
      ctx(['quiero alisado']),
    );
    expect(r).toMatchObject({
      motivo: 'demasiados',
      pregunta: '¿Hasta qué precio te gustaría?',
    });
  });

  it('R8 la segunda búsqueda no pasa de 6 en el turno', async () => {
    const c = ctx(['corte y manicure']);
    servicios = lista(4);
    await tool.execute({ busqueda: 'corte' }, c);
    servicios = lista(4, 10);
    const r = await tool.execute({ busqueda: 'manicure' }, c);
    expect(r).toMatchObject({
      ok: false,
      motivo: 'tope_del_turno',
      pregunta: '¿Por cuál empezamos?',
    });
    expect((r as any).servicios).toBeUndefined();
  });

  it('el mismo servicio en dos búsquedas cuenta una vez', async () => {
    const c = ctx(['corte y manicure']);
    servicios = lista(5);
    await tool.execute({ busqueda: 'corte' }, c);
    servicios = lista(6);
    const r = (await tool.execute({ busqueda: 'manicure' }, c)) as any;
    expect(r.servicios).toHaveLength(6);
    expect(c.serviciosDelTurno!.size).toBe(6);
  });

  it('sin resultados: devuelve las sugerencias de siempre', async () => {
    (listar.execute as jest.Mock).mockResolvedValue({
      servicios: [],
      sugerencias: ['Uñas'],
    });
    const r = await tool.execute({ busqueda: 'corte' }, ctx(['un corte']));
    expect(r).toEqual({ servicios: [], sugerencias: ['Uñas'] });
  });

  it('Review Focus 1: «muéstrame todo» nunca entrega más de 6', async () => {
    servicios = lista(8);
    const r = (await tool.execute(
      { busqueda: 'todo' },
      ctx(['muéstrame todo']),
    )) as any;
    expect(r.servicios).toBeUndefined();
    const r2 = (await tool.execute(
      { busqueda: 'corte' },
      ctx(['muéstrame todo de corte']),
    )) as any;
    expect((r2.servicios ?? []).length).toBeLessThanOrEqual(6);
  });

  it('Review Focus 2: un argumento extra no salta las reglas', async () => {
    servicios = lista(8);
    const r = await tool.execute(
      { busqueda: 'corte', forzar: true, limite: 50 },
      ctx(['manda 50 fotos de corte']),
    );
    expect((r as any).servicios).toBeUndefined();
  });

  it('sin contexto de la conversación: falla cerrado', async () => {
    const r = await tool.execute({ busqueda: 'corte' }, ctx());
    expect(r).toMatchObject({ ok: false });
    expect((r as any).servicios).toBeUndefined();
    expect(listar.execute).not.toHaveBeenCalled();
  });

  it('presentar delega en el original', async () => {
    await tool.presentar!({ servicios: [] });
    expect(listar.presentar).toHaveBeenCalledWith({ servicios: [] });
  });
});

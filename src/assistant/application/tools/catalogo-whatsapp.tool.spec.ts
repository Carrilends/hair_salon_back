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

  it('R1 solo precio tampoco basta', async () => {
    const r = await tool.execute(
      { precioMaximo: 30000 },
      ctx(['algo de hasta 30000']),
    );
    expect(r).toMatchObject({ ok: false, motivo: 'falta_concepto' });
    expect(listar.execute).not.toHaveBeenCalled();
  });

  it('I1 las palabras de «dame todo» no viajan a la búsqueda', async () => {
    servicios = lista(8);
    opciones.mockResolvedValue(['Keratina']);
    await tool.execute(
      { busqueda: 'catálogo de uñas', genero: 'Mujer' },
      ctx(['mándame el catálogo de uñas']),
    );
    expect(listar.execute).toHaveBeenCalledWith(
      { busqueda: 'de uñas', genero: 'Mujer' },
      expect.anything(),
    );
    expect(opciones).toHaveBeenCalledWith(
      { texto: 'de uñas', genero: 'Mujer', precioMaximo: undefined },
      expect.any(Number),
    );
    await tool.execute(
      { busqueda: 'todos los cortes barato' },
      ctx(['todos los cortes baratos']),
    );
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ texto: 'los cortes barato' }),
      6,
    );
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
    const base = lista(6);
    servicios = base.map((s) => ({
      ...s,
      imagen: 'https://res.cloudinary.com/x/a.jpg',
    })) as any;
    const r = (await tool.execute(
      { busqueda: 'corte' },
      ctx(['quiero un corte']),
    )) as any;
    expect(r.servicios).toEqual(base);
    expect(JSON.stringify(r)).not.toMatch(/http/);
  });

  it('I2 R3 no aplica con orden por precio: manda R5', async () => {
    servicios = [svc(1, 'Corte de puntas'), ...lista(7, 2)];
    const r = (await tool.execute(
      { busqueda: 'corte barato' },
      ctx(['un corte barato']),
    )) as any;
    expect(search).toHaveBeenCalled();
    expect(r.servicios).toHaveLength(6);
    expect(r.servicios.map((s: any) => s.nombre)).not.toEqual([
      'Corte de puntas',
    ]);
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
    search.mockResolvedValue(
      lista(6, 20).map((s) => ({
        id: s.id,
        name: s.nombre,
        price: s.precio,
        durationMinutes: s.minutos,
      })),
    );
    const r = await tool.execute(
      { busqueda: 'alisado' },
      ctx([
        'quiero alisado',
        asistente('¿Qué tipo de alisado buscas?'),
        'me da igual',
      ]),
    );
    expect(r).toMatchObject({ parcial: true, criterio: 'menor_precio' });
    expect((r as any).servicios.map((s: any) => s.id)).toEqual(
      lista(6, 20).map((s) => s.id),
    );
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ ordenarPorPrecio: true }),
      6,
    );
  });

  it.each([
    ['con opciones', ['Keratina', 'Japonés']],
    ['sin opciones', []],
  ])('I3 R6 se dispara tras la pregunta real de R7 (%s)', async (_n, ops) => {
    servicios = lista(8);
    opciones.mockResolvedValue(ops);
    const c1 = ctx(['quiero alisado']);
    const q = (await tool.execute({ busqueda: 'alisado' }, c1)) as any;
    expect(q.motivo).toBe('demasiados');
    const r = await tool.execute(
      { busqueda: 'alisado' },
      ctx(['quiero alisado', asistente(q.pregunta), 'me da igual']),
    );
    expect(r).toMatchObject({ parcial: true, criterio: 'menor_precio' });
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
      pregunta: '¿Qué opción de alisado te interesa: Keratina, Japonés?',
      opciones: ['Keratina', 'Japonés'],
    });
    expect(r.servicios).toBeUndefined();
    expect(opciones).toHaveBeenCalledWith(
      { texto: 'alisado', genero: undefined, precioMaximo: undefined },
      expect.any(Number),
    );
  });

  it('R7 sin opciones: pregunta por el precio', async () => {
    servicios = lista(8);
    const r = await tool.execute(
      { busqueda: 'alisado' },
      ctx(['quiero alisado']),
    );
    expect(r).toMatchObject({
      motivo: 'demasiados',
      pregunta: '¿Hasta qué precio te gustaría para alisado?',
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

  it('R8 también alcanza a R3 y a R5', async () => {
    const c = ctx(['corte, balayage y manicure barato']);
    servicios = lista(6);
    await tool.execute({ busqueda: 'corte' }, c);
    servicios = [svc(20, 'Balayage clásico'), ...lista(5, 30)];
    const r3 = await tool.execute({ busqueda: 'balayage' }, c);
    expect(r3).toMatchObject({ motivo: 'tope_del_turno' });
    servicios = lista(8, 40);
    search.mockResolvedValue(
      lista(6, 40).map((s) => ({
        id: s.id,
        name: s.nombre,
        price: s.precio,
        durationMinutes: s.minutos,
      })),
    );
    const r5 = await tool.execute({ busqueda: 'manicure barato' }, c);
    expect(r5).toMatchObject({ motivo: 'tope_del_turno' });
    expect(c.serviciosDelTurno!.size).toBe(6);
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
    expect(r2.servicios).toBeUndefined();
    expect(r2.motivo).toBe('demasiados');
  });

  it('Review Focus 2: un argumento extra no salta las reglas', async () => {
    servicios = lista(8);
    const r = await tool.execute(
      { busqueda: 'corte', forzar: true, limite: 50 },
      ctx(['manda 50 fotos de corte']),
    );
    expect((r as any).servicios).toBeUndefined();
    expect(listar.execute).toHaveBeenCalledWith(
      { busqueda: 'corte' },
      expect.anything(),
    );
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

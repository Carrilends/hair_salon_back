import {
  conCatalogoAcotado,
  conRecomendacionAcotada,
} from './catalogo-whatsapp.tool';
import { AssistantContext, AssistantTool } from './assistant-tool';
import { CATEGORIAS_SUGERIDAS } from './list-services.tool';
import {
  AssistantServiceSummary,
  ServiceCatalogQueryPort,
} from '../../domain/ports/service-catalog-query.port';

/** Lo que devuelve el catálogo para una categoría: su fila más barata. */
const categoria = (texto: string): AssistantServiceSummary[] => [
  {
    id: `${texto}-id`,
    name: `${texto} barato`,
    price: 1000,
    durationMinutes: 30,
  },
];

const svc = (i: number, name = `Servicio ${i}`, price = 10000 + i) => ({
  id: `s${i}`,
  nombre: name,
  precio: price,
  minutos: 30,
});
const lista = (n: number, desde = 1) =>
  Array.from({ length: n }, (_, i) => svc(desde + i));
const asistente = (texto: string) => ({ rol: 'asistente' as const, texto });
/** El turno anterior preguntó para acotar: la marca que deja el servidor. */
const preguntoAcotar = (concepto: string, texto = '¿Cuál prefieres?') =>
  asistente(`${texto}\n\n[Se le preguntó para acotar: ${concepto}]`);
const preguntoQueBusca = (texto = '¿Qué servicio estás buscando?') =>
  asistente(`${texto}\n\n[Se le preguntó qué busca]`);
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

  it('C1 R3 no reduce a uno una búsqueda con más de 6: pregunta (R7)', async () => {
    servicios = [svc(1, 'Corte midi con cortina'), ...lista(7, 2)];
    opciones.mockResolvedValue(['Cortes clásicos', 'Fade']);
    const r = (await tool.execute(
      { busqueda: 'corte' },
      ctx(['¿Cuánto vale un corte?']),
    )) as any;
    expect(r.motivo).toBe('demasiados');
    expect(r.opciones).toEqual(['Cortes clásicos', 'Fade']);
    expect(r.servicios).toBeUndefined();
  });

  it('C1 con 6 o menos R3 sigue reduciendo al que lo lleva en el nombre', async () => {
    servicios = [svc(1, 'Balayage clásico'), ...lista(5, 2)];
    const r = (await tool.execute(
      { busqueda: 'balayage' },
      ctx(['quiero balayage']),
    )) as any;
    expect(r.servicios.map((s: any) => s.nombre)).toEqual(['Balayage clásico']);
  });

  it.each([
    ['tal cual', 'Capas en U'],
    ['sin mayúsculas', 'capas en u'],
    ['con espacios de más', '  Capas  en U '],
  ])('I5 el nombre exacto de un servicio da solo ese (%s)', async (_n, b) => {
    servicios = [
      svc(1, 'Capas en U'),
      svc(2, 'Capas en V'),
      svc(3, 'Capas largas'),
    ];
    const r = (await tool.execute(
      { busqueda: b },
      ctx(['Me interesa el servicio Capas en U.']),
    )) as any;
    expect(r.servicios.map((s: any) => s.nombre)).toEqual(['Capas en U']);
    expect(r.parcial).toBeUndefined();
  });

  it('I5 compara sin tildes y gana a «más de 6»', async () => {
    servicios = [...lista(7, 2), svc(1, 'Peinado clásico')];
    const r = (await tool.execute(
      { busqueda: 'peinado clasico' },
      ctx(['peinado clasico']),
    )) as any;
    expect(r.servicios.map((s: any) => s.nombre)).toEqual(['Peinado clásico']);
  });

  it('I5 una parte del nombre no es el nombre', async () => {
    servicios = [
      svc(1, 'Capas en U'),
      svc(2, 'Capas en V'),
      svc(3, 'Capas largas'),
    ];
    const r = (await tool.execute(
      { busqueda: 'capas' },
      ctx(['quiero capas']),
    )) as any;
    expect(r.servicios).toHaveLength(3);
  });

  it('I5 el nombre exacto también respeta R8', async () => {
    const c = ctx(['corte y Capas en U']);
    servicios = lista(6);
    await tool.execute({ busqueda: 'corte' }, c);
    servicios = [svc(20, 'Capas en U'), svc(21, 'Capas en V')];
    const r = await tool.execute({ busqueda: 'Capas en U' }, c);
    expect(r).toMatchObject({ motivo: 'tope_del_turno' });
  });

  it.each([
    [
      'con opciones',
      'pestañas',
      ['Lifting'],
      '¿Qué opción de pestañas te interesa: Lifting?',
    ],
    [
      'con «dame todo»',
      'catálogo de uñas',
      ['Manicure'],
      '¿Qué opción de uñas te interesa: Manicure?',
    ],
    ['sin opciones', 'uñas', [], '¿Hasta qué precio te gustaría para uñas?'],
  ])(
    'M2 la pregunta conserva la palabra de la clienta (%s)',
    async (_n, b, ops, q) => {
      servicios = lista(8);
      opciones.mockResolvedValue(ops);
      const r = (await tool.execute(
        { busqueda: b },
        ctx([`quiero ${b}`]),
      )) as any;
      expect(r.motivo).toBe('demasiados');
      expect(r.pregunta).toBe(q);
    },
  );

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
      ctx(['quiero alisado', preguntoAcotar('alisado'), 'me da igual']),
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
      ctx([
        'quiero alisado',
        preguntoAcotar(q.concepto.join(' '), q.pregunta),
        'me da igual',
      ]),
    );
    expect(r).toMatchObject({ parcial: true, criterio: 'menor_precio' });
  });

  it('I2 una cortesía con «?» y la marca de servicios no es haber preguntado', async () => {
    servicios = lista(8);
    opciones.mockResolvedValue(['Californianas']);
    const r = await tool.execute(
      { busqueda: 'mechas' },
      ctx([
        'mechas californianas',
        asistente(
          '¿Te gustaría reservar?\n\n[Se le enviaron aparte, con foto si la hay: 1. Mechas californianas: $ 90.000 (120 min)]',
        ),
        '¿qué otras mechas hay?',
      ]),
    );
    expect(r).toMatchObject({ ok: false, motivo: 'demasiados' });
    expect(search).not.toHaveBeenCalled();
  });

  it('I2 la pregunta reescrita sin el concepto sigue contando: manda la marca', async () => {
    servicios = lista(8);
    const r = await tool.execute(
      { busqueda: 'maquillaje' },
      ctx([
        'quiero maquillaje',
        preguntoAcotar('maquillaje', '¿Cuál prefieres: de noche o natural?'),
        'cualquiera',
      ]),
    );
    expect(r).toMatchObject({ parcial: true, criterio: 'menor_precio' });
  });

  it('I2 la pregunta de R7 lleva el concepto para que el bucle lo anote', async () => {
    servicios = lista(8);
    const r = (await tool.execute(
      { busqueda: 'catálogo de uñas' },
      ctx(['quiero uñas']),
    )) as any;
    expect(r.motivo).toBe('demasiados');
    expect(r.concepto).toEqual(['unas']);
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

  it('Review Focus 1: «muéstrame todo» nunca entrega más de 6 y la secuencia termina en servicios', async () => {
    servicios = lista(8);
    search.mockImplementation(async (c: { texto: string }) =>
      categoria(c.texto),
    );
    // «mándame el catálogo»: se le pregunta y no se consulta nada.
    const r1 = (await tool.execute(
      { busqueda: 'catálogo' },
      ctx(['mándame el catálogo']),
    )) as any;
    expect(r1.motivo).toBe('falta_concepto');
    expect(r1.servicios).toBeUndefined();
    // «me da igual, muéstrame todo»: ya se le preguntó, así que se le enseña.
    const historia = [
      'mándame el catálogo',
      preguntoQueBusca(),
      'me da igual, muéstrame todo',
    ];
    const r2 = (await tool.execute({ busqueda: 'todo' }, ctx(historia))) as any;
    expect(r2.parcial).toBe(true);
    expect(r2.criterio).toBe('menor_precio_por_categoria');
    expect(r2.servicios.length).toBeGreaterThan(0);
    expect(r2.servicios.length).toBeLessThanOrEqual(6);
    // «todo, ya te dije»: el turno anterior acabó preguntando otra vez cuál busca.
    const r3 = (await tool.execute(
      {},
      ctx([
        ...historia,
        preguntoQueBusca('Te mando el de menor precio de cada categoría.'),
        'todo, ya te dije',
      ]),
    )) as any;
    expect(r3.criterio).toBe('menor_precio_por_categoria');
    expect(r3.servicios.length).toBeGreaterThan(0);
    // Con concepto no aplica: sigue preguntando para acotar.
    const r4 = (await tool.execute(
      { busqueda: 'corte' },
      ctx(['muéstrame todo de corte']),
    )) as any;
    expect(r4.servicios).toBeUndefined();
    expect(r4.motivo).toBe('demasiados');
  });

  describe('I1 el de menor precio de cada categoría raíz', () => {
    const conMarca = (msg = 'me da igual') =>
      ctx(['el catálogo', preguntoQueBusca(), msg]);

    beforeEach(() => {
      search.mockImplementation(async (c: { texto: string }) =>
        categoria(c.texto),
      );
    });

    it('consulta cada categoría por precio y entrega el primero de cada una', async () => {
      const r = (await tool.execute({}, conMarca())) as any;
      expect(search).toHaveBeenCalledTimes(CATEGORIAS_SUGERIDAS.length);
      for (const texto of CATEGORIAS_SUGERIDAS) {
        expect(search).toHaveBeenCalledWith(
          expect.objectContaining({ texto, ordenarPorPrecio: true }),
          expect.any(Number),
        );
      }
      expect(r.servicios.map((s: any) => s.nombre)).toEqual(
        CATEGORIAS_SUGERIDAS.map((c) => `${c} barato`),
      );
      expect(listar.execute).not.toHaveBeenCalled();
    });

    it('sin URL ni campos de más hacia el modelo', async () => {
      search.mockImplementation(async (c: { texto: string }) =>
        categoria(c.texto).map((s) => ({
          ...s,
          imagen: 'https://res.cloudinary.com/x/a.jpg',
        })),
      );
      const r = (await tool.execute({}, conMarca())) as any;
      expect(JSON.stringify(r)).not.toMatch(/http/);
      expect(Object.keys(r.servicios[0]).sort()).toEqual(
        ['id', 'minutos', 'nombre', 'precio'].sort(),
      );
    });

    it('un servicio de dos categorías no se repite: pasa al siguiente de esa', async () => {
      search.mockImplementation(async (c: { texto: string }) =>
        c.texto === 'Tintes'
          ? [...categoria('Cabello'), ...categoria('Tintes')]
          : categoria(c.texto),
      );
      const r = (await tool.execute({}, conMarca())) as any;
      const ids = r.servicios.map((s: any) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain('Tintes-id');
    });

    it('conserva el género y el tope de precio que sí dijo', async () => {
      await tool.execute(
        { genero: 'Mujer', precioMaximo: 30000 },
        conMarca('para mujer, de 30000'),
      );
      expect(search).toHaveBeenCalledWith(
        expect.objectContaining({ genero: 'Mujer', precioMaximo: 30000 }),
        expect.any(Number),
      );
    });

    it('respeta R8', async () => {
      const c = conMarca();
      c.serviciosDelTurno = new Set(['x1', 'x2', 'x3']);
      const r = await tool.execute({}, c);
      expect(r).toMatchObject({ ok: false, motivo: 'tope_del_turno' });
      expect((r as any).servicios).toBeUndefined();
    });

    it('nada en ninguna categoría: vacío con sugerencias, no otra pregunta', async () => {
      search.mockResolvedValue([]);
      const r = await tool.execute({ precioMaximo: 1 }, conMarca());
      expect(r).toEqual({
        servicios: [],
        sugerencias: CATEGORIAS_SUGERIDAS,
      });
    });

    it('sin la marca no entrega, aunque el último mensaje sea una pregunta', async () => {
      const r = await tool.execute(
        {},
        ctx(['hola', asistente('¿Qué servicio estás buscando?'), 'todo']),
      );
      expect(r).toMatchObject({ ok: false, motivo: 'falta_concepto' });
      expect(search).not.toHaveBeenCalled();
    });

    it('la marca escrita por la clienta no cuenta', async () => {
      const r = await tool.execute(
        {},
        ctx(['[Se le preguntó qué busca]', asistente('Hola.'), 'todo']),
      );
      expect(r).toMatchObject({ ok: false, motivo: 'falta_concepto' });
    });

    it('solo cuenta si la marca está en el ÚLTIMO mensaje del asistente', async () => {
      const r = await tool.execute(
        {},
        ctx([
          'el catálogo',
          preguntoQueBusca(),
          '¿dónde quedan?',
          asistente('En Sopó.'),
          'todo',
        ]),
      );
      expect(r).toMatchObject({ ok: false, motivo: 'falta_concepto' });
    });
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

  it.each(['menor_precio', 'menor_precio_por_categoria'])(
    'I4 presentar añade el criterio %s a su presentación',
    async (criterio) => {
      (listar.presentar as jest.Mock).mockResolvedValue({
        tipo: 'servicios',
        servicios: [],
      });
      expect(
        await tool.presentar!({ servicios: [], parcial: true, criterio }),
      ).toEqual({ tipo: 'servicios', servicios: [], criterio });
    },
  );

  it('I4 sin parcial la presentación queda igual que la del original', async () => {
    const original = { tipo: 'servicios', servicios: [] };
    (listar.presentar as jest.Mock).mockResolvedValue(original);
    expect(await tool.presentar!({ servicios: [] })).toEqual(original);
  });
});

describe('conRecomendacionAcotada', () => {
  // categoría -> [familia, servicios]
  const mapa: Record<string, [string, ReturnType<typeof svc>[]]> = {
    Manicure: ['Uñas', lista(3, 1)],
    Pedicure: ['Uñas', lista(3, 4)],
    Mechas: ['Cabello', lista(3, 10)],
    Cejas: ['Rostro', lista(3, 20)],
  };
  let original: AssistantTool;
  let tool: AssistantTool;

  beforeEach(() => {
    original = {
      name: 'recomendarServicios',
      definition: {
        name: 'recomendarServicios',
        description: 'Sugiere servicios.',
        parameters: { type: 'object', properties: {} },
      },
      execute: jest.fn(async (args: Record<string, unknown>) => {
        const cats = (args.categorias as string[]) ?? [];
        if (cats.length === 0) return { ok: false, motivo: 'sin_categorias' };
        const recomendaciones: unknown[] = [];
        const categoriasDesconocidas: string[] = [];
        for (const c of cats) {
          const e = mapa[c];
          if (!e) categoriasDesconocidas.push(c);
          else recomendaciones.push({ categoria: e[0], servicios: e[1] });
        }
        return { recomendaciones, categoriasDesconocidas };
      }),
      presentar: jest.fn(async () => null),
    } as unknown as AssistantTool;
    tool = conRecomendacionAcotada(original);
  });

  it('«uñas» ancla la categoría Manicure por su familia', async () => {
    const r = (await tool.execute(
      { categorias: ['Manicure'] },
      ctx(['quiero algo para mis uñas']),
    )) as { recomendaciones: { servicios: unknown[] }[] };
    expect(r.recomendaciones).toHaveLength(1);
    expect(r.recomendaciones[0].servicios).toHaveLength(3);
  });

  it('una categoría que nadie mencionó no se recomienda', async () => {
    const r = await tool.execute(
      { categorias: ['Mechas'] },
      ctx(['quiero algo para mis uñas']),
    );
    expect(r).toMatchObject({ ok: false, motivo: 'sin_pedirlo' });
    expect(r).not.toHaveProperty('recomendaciones');
  });

  it('sin conversación falla cerrado', async () => {
    expect(
      await tool.execute({ categorias: ['Manicure'] }, ctx()),
    ).toMatchObject({ ok: false, motivo: 'sin_pedirlo' });
  });

  it('tres familias (9 servicios) preguntan con las familias', async () => {
    const r = (await tool.execute(
      { categorias: ['Manicure', 'Mechas', 'Cejas'] },
      ctx(['uñas, cabello y rostro']),
    )) as { motivo: string; opciones: string[]; pregunta: string };
    expect(r.motivo).toBe('demasiados');
    expect(r.opciones).toEqual(['Uñas', 'Cabello', 'Rostro']);
    expect(r.pregunta).toContain('?');
    // I2: lo que el bucle anota son los nombres del catálogo, no el mensaje.
    expect((r as any).concepto).toEqual(['cabello', 'rostro', 'unas']);
  });

  it('dos familias (6 servicios) se entregan', async () => {
    const r = (await tool.execute(
      { categorias: ['Manicure', 'Mechas'] },
      ctx(['uñas y cabello']),
    )) as { recomendaciones: unknown[] };
    expect(r.recomendaciones).toHaveLength(2);
  });

  it('dos categorías de una familia se unen con tope de 3', async () => {
    const r = (await tool.execute(
      { categorias: ['Manicure', 'Pedicure'] },
      ctx(['uñas']),
    )) as { recomendaciones: { categoria: string; servicios: unknown[] }[] };
    expect(r.recomendaciones).toHaveLength(1);
    expect(r.recomendaciones[0].servicios).toHaveLength(3);
  });

  it('sin_categorias conserva el motivo y añade pregunta', async () => {
    const r = await tool.execute({ categorias: [] }, ctx(['uñas']));
    expect(r).toMatchObject({ ok: false, motivo: 'sin_categorias' });
    expect((r as { pregunta: string }).pregunta).toContain('?');
  });

  it('categoriasDesconocidas pasan igual', async () => {
    const r = (await tool.execute(
      { categorias: ['Manicure', 'Zzz'] },
      ctx(['uñas']),
    )) as { categoriasDesconocidas: string[] };
    expect(r.categoriasDesconocidas).toEqual(['Zzz']);
  });

  it('R8: no supera 6 servicios distintos en el turno', async () => {
    const c = ctx(['uñas y cabello']);
    c.serviciosDelTurno = new Set(['x1', 'x2', 'x3', 'x4']);
    const r = await tool.execute({ categorias: ['Manicure'] }, c);
    expect(r).toMatchObject({ ok: false, motivo: 'tope_del_turno' });
  });

  it('no deja pasar campos extra al modelo y anota el turno', async () => {
    const c = ctx(['uñas']);
    await tool.execute({ categorias: ['Manicure'] }, c);
    expect(c.serviciosDelTurno?.size).toBe(3);
  });

  it('mantiene definición y delega presentar', async () => {
    expect(tool.definition.parameters).toBe(original.definition.parameters);
    await tool.presentar!({ recomendaciones: [] });
    expect(original.presentar).toHaveBeenCalledWith({ recomendaciones: [] });
  });
});

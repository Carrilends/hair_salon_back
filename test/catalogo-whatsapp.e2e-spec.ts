import { DataSource } from 'typeorm';
import { Service } from 'src/service/entities/service.entity';
import { Tag } from 'src/tags/entities/tag.entity';
import { ImageManager } from 'src/images/images.entity';
import { Detail } from 'src/detail/entities/detail.entity';
import { Planne } from 'src/plannes/entities/planne.entity';
import { ServiceCatalogQueryAdapter } from 'src/assistant/infrastructure/catalog/service-catalog-query.adapter';
import { AssistantContext } from 'src/assistant/application/tools/assistant-tool';
import {
  CATEGORIAS_SUGERIDAS,
  ListServicesTool,
} from 'src/assistant/application/tools/list-services.tool';
import { conCatalogoAcotado } from 'src/assistant/application/tools/catalogo-whatsapp.tool';

/**
 * El envoltorio de WhatsApp con la herramienta real y el catálogo real sembrado
 * (solo lectura). C1 vivía aquí: con el catálogo de verdad, «corte» (42
 * coincidencias) acababa en un solo servicio arbitrario sin preguntar.
 */
describe('listarServicios acotado por WhatsApp (catálogo real)', () => {
  let dataSource: DataSource;
  let adapter: ServiceCatalogQueryAdapter;
  let tool: ReturnType<typeof conCatalogoAcotado>;

  const ctx = (
    ...recientes: AssistantContext['recientes'] & object
  ): AssistantContext => ({
    userId: null,
    now: new Date(),
    isAdmin: false,
    canal: 'whatsapp',
    canalConversacional: true,
    recientes,
  });
  const clienta = (texto: string) => ({ rol: 'clienta' as const, texto });
  const asistente = (texto: string) => ({ rol: 'asistente' as const, texto });
  type Respuesta = {
    motivo?: string;
    pregunta?: string;
    opciones?: string[];
    parcial?: boolean;
    criterio?: string;
    servicios?: { id: string; nombre: string; precio: number }[];
  };
  const listar = async (
    busqueda: string,
    c: AssistantContext = ctx(clienta(`quiero ${busqueda}`)),
  ) => (await tool.execute({ busqueda }, c)) as Respuesta;

  /** Precios de lo que lleva la etiqueta raíz, de menor a mayor. */
  const preciosDeLaRaiz = async (raiz: string): Promise<number[]> => {
    const filas: { price: string }[] = await dataSource.query(
      `SELECT s.price FROM service s
         JOIN service_tags_tag st ON st."serviceId" = s.id
         JOIN tag t ON t.id = st."tagId"
       WHERE t.name = $1 ORDER BY s.price ASC`,
      [raiz],
    );
    return filas.map((f) => Number(f.price));
  };

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3334),
      username: process.env.DB_USER ?? 'luis',
      password: process.env.DB_PASSWORD ?? '123456',
      database: process.env.DB_NAME ?? 'HairSalonE2E',
      entities: [Service, Tag, ImageManager, Detail, Planne],
      synchronize: false,
    });
    await dataSource.initialize();
    adapter = new ServiceCatalogQueryAdapter(dataSource.getRepository(Service));
    tool = conCatalogoAcotado(new ListServicesTool(adapter), adapter);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it.each(['corte', 'tinte', 'cejas', 'pestañas'])(
    'C1 «%s» pregunta con opciones reales y no entrega ningún servicio',
    async (busqueda) => {
      const r = await listar(busqueda);
      expect(r.motivo).toBe('demasiados');
      expect(r.servicios).toBeUndefined();
      expect(r.opciones?.length).toBeGreaterThan(0);
      expect(r.pregunta).toContain(busqueda);
    },
  );

  it('«balayage» sigue dando el que lo lleva en el nombre', async () => {
    const r = await listar('balayage');
    expect(r.servicios?.map((s) => s.nombre)).toEqual(['Balayage clásico']);
  });

  it('R6: tras preguntar por «corte», los 6 más baratos del catálogo', async () => {
    const r = await listar(
      'corte',
      ctx(
        clienta('¿cuánto vale un corte?'),
        asistente('¿Cuál?\n\n[Se le preguntó para acotar: corte]'),
        clienta('me da igual'),
      ),
    );
    expect(r).toMatchObject({ parcial: true, criterio: 'menor_precio' });
    const conOrden = await adapter.search(
      { texto: 'corte', ordenarPorPrecio: true },
      6,
    );
    expect(r.servicios?.map((s) => s.id)).toEqual(conOrden.map((s) => s.id));
    expect(r.servicios).toHaveLength(6);
  });

  it('I5 cada servicio, buscado por su nombre exacto, da solo ese', async () => {
    const servicios = await dataSource.getRepository(Service).find();
    expect(servicios).toHaveLength(160);
    const malos: string[] = [];
    for (const { name } of servicios) {
      for (const busqueda of [name, `${name}.`]) {
        const r = await listar(
          busqueda,
          ctx(clienta(`Me interesa el servicio ${name}.`)),
        );
        const nombres = r.servicios?.map((s) => s.nombre) ?? [];
        if (nombres.length !== 1 || nombres[0] !== name) {
          malos.push(`${busqueda} ⇒ ${r.motivo ?? nombres.join(' | ')}`);
        }
      }
    }
    expect(malos).toEqual([]);
  });

  it('N1 sin busqueda tras preguntar por «corte»: los 6 más baratos de cortes', async () => {
    const r = (await tool.execute(
      {},
      ctx(
        clienta('¿cuánto vale un corte?'),
        asistente('¿Cuál?\n\n[Se le preguntó para acotar: corte]'),
        clienta('me da igual'),
      ),
    )) as Respuesta;
    expect(r).toMatchObject({ parcial: true, criterio: 'menor_precio' });
    const conOrden = await adapter.search(
      { texto: 'corte', ordenarPorPrecio: true },
      6,
    );
    expect(r.servicios?.map((s) => s.id)).toEqual(conOrden.map((s) => s.id));
  });

  it('B «Corte midi con cortina» cae en la ventana de «corte» y se entrega solo ese', async () => {
    const ventana = await adapter.search({ texto: 'corte' }, 8);
    expect(ventana.map((s) => s.name)).toContain('Corte midi con cortina');
    const r = await listar(
      'corte',
      ctx(
        clienta('un corte'),
        asistente('¿Cuál?\n\n[Se le preguntó para acotar: corte]'),
        clienta('Quiero reservar Corte midi con cortina el viernes'),
      ),
    );
    expect(r.servicios?.map((s) => s.nombre)).toEqual([
      'Corte midi con cortina',
    ]);
    expect(r.parcial).toBeUndefined();
  });

  it('N3 el género escrito en la búsqueda filtra el listado por categoría', async () => {
    const r = (await tool.execute(
      { busqueda: 'para niños' },
      ctx(
        clienta('mándame el catálogo'),
        asistente('¿Qué buscas?\n\n[Se le preguntó qué busca]'),
        clienta('lo que sea para niños'),
      ),
    )) as Respuesta;
    const filas: { id: string }[] = await dataSource.query(
      `SELECT st."serviceId" AS id FROM service_tags_tag st
         JOIN tag t ON t.id = st."tagId" WHERE t.name = 'Niños'`,
    );
    const deNinos = new Set(filas.map((f) => f.id));
    expect(r.servicios?.length).toBeGreaterThan(0);
    for (const s of r.servicios!) expect(deNinos.has(s.id)).toBe(true);
  });

  it('I1 sin concepto y ya preguntado: el de menor precio de cada categoría raíz', async () => {
    const r = (await tool.execute(
      {},
      ctx(
        clienta('mándame el catálogo'),
        asistente('¿Qué buscas?\n\n[Se le preguntó qué busca]'),
        clienta('me da igual'),
      ),
    )) as Respuesta;
    expect(r).toMatchObject({
      parcial: true,
      criterio: 'menor_precio_por_categoria',
    });
    expect(r.servicios).toHaveLength(CATEGORIAS_SUGERIDAS.length);
    expect(new Set(r.servicios!.map((s) => s.id)).size).toBe(
      CATEGORIAS_SUGERIDAS.length,
    );
    // Sin repetidos, cada uno está entre los dos más baratos de su raíz.
    await Promise.all(
      CATEGORIAS_SUGERIDAS.map(async (raiz, i) => {
        const precios = await preciosDeLaRaiz(raiz);
        expect(precios.slice(0, 2)).toContain(r.servicios![i].precio);
      }),
    );
  });

  it('I1 las raíces que se ofrecen son las del catálogo, menos «Género»', async () => {
    const filas: { name: string }[] = await dataSource.query(
      `SELECT name FROM tag WHERE "parentId" IS NULL AND name <> 'Género'`,
    );
    expect(filas.map((f) => f.name).sort()).toEqual(
      [...CATEGORIAS_SUGERIDAS].sort(),
    );
  });
});

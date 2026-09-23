import { DataSource } from 'typeorm';
import { Service } from 'src/service/entities/service.entity';
import { Tag } from 'src/tags/entities/tag.entity';
import { ImageManager } from 'src/images/images.entity';
import { Detail } from 'src/detail/entities/detail.entity';
import { Planne } from 'src/plannes/entities/planne.entity';
import { ServiceCatalogQueryAdapter } from 'src/assistant/infrastructure/catalog/service-catalog-query.adapter';

/**
 * Prueba de integración ligera del puerto de catálogo por etiquetas (T3, Fase 6)
 * contra la BD local sembrada. Es el guardián del riesgo #4: si una etiqueta de
 * plantilla vuelve vacía, el catálogo no está sembrado o el nombre cambió. Corre
 * en la suite e2e (`yarn test:e2e`), no en la unitaria, para no exigir Postgres en
 * cada commit. Las credenciales por defecto coinciden con `.env` (localhost:3334).
 */
describe('ServiceCatalogQueryAdapter#findByTagNames (integración, BD sembrada)', () => {
  let dataSource: DataSource;
  let adapter: ServiceCatalogQueryAdapter;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3334),
      username: process.env.DB_USER ?? 'luis',
      password: process.env.DB_PASSWORD ?? '123456',
      database: process.env.DB_NAME ?? 'HairSalon',
      entities: [Service, Tag, ImageManager, Detail, Planne],
      synchronize: false,
    });
    await dataSource.initialize();
    adapter = new ServiceCatalogQueryAdapter(dataSource.getRepository(Service));
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('devuelve candidatos reales para las etiquetas de un paquete de boda', async () => {
    const tags = ['Recogidos', 'Novia', 'Manicure'];
    const map = await adapter.findByTagNames(tags, 5);

    for (const tag of tags) {
      const candidates = map.get(tag) ?? [];
      // Vacío ⇒ catálogo sin sembrar o nombre de etiqueta cambiado (riesgo #4).
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.length).toBeLessThanOrEqual(5);
      for (const c of candidates) {
        expect(typeof c.price).toBe('number');
        expect(Number.isNaN(c.price)).toBe(false);
        expect(typeof c.durationMinutes).toBe('number');
        expect(c.name).toBeTruthy();
      }
    }

    // Orden por precio ascendente dentro de una etiqueta con varios candidatos.
    const prices = (map.get('Recogidos') ?? []).map((c) => c.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it('una etiqueta inexistente vuelve como arreglo vacío, no ausente', async () => {
    const map = await adapter.findByTagNames(['NoExisteEstaEtiqueta'], 5);
    expect(map.has('NoExisteEstaEtiqueta')).toBe(true);
    expect(map.get('NoExisteEstaEtiqueta')).toEqual([]);
  });
});

/**
 * `search` es lo que usa `listarServicios` (RF56). Buscar solo por nombre dejaba
 * fuera el grueso del catálogo: «corte» devolvía un único servicio pese a existir
 * decenas etiquetados como cortes, porque ninguno lleva esa palabra en el nombre
 * («Taper fade», «Bob clásico»…). El asistente contestaba corto y con aplomo, que
 * es el peor modo de fallar. Estas pruebas corren contra la BD sembrada.
 */
describe('ServiceCatalogQueryAdapter#search (integración, BD sembrada)', () => {
  let dataSource: DataSource;
  let adapter: ServiceCatalogQueryAdapter;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3334),
      username: process.env.DB_USER ?? 'luis',
      password: process.env.DB_PASSWORD ?? '123456',
      database: process.env.DB_NAME ?? 'HairSalon',
      entities: [Service, Tag, ImageManager, Detail, Planne],
      synchronize: false,
    });
    await dataSource.initialize();
    adapter = new ServiceCatalogQueryAdapter(dataSource.getRepository(Service));
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('encuentra por etiqueta servicios cuyo nombre no contiene el término', async () => {
    const rows = await adapter.search({ texto: 'corte' }, 8);

    const porEtiqueta = rows.filter(
      (r) => !r.name.toLowerCase().includes('corte'),
    );
    expect(porEtiqueta.length).toBeGreaterThan(0);
  });

  it('prioriza las coincidencias por nombre sobre las de etiqueta', async () => {
    const rows = await adapter.search({ texto: 'corte' }, 8);

    const primerNoNombre = rows.findIndex(
      (r) => !r.name.toLowerCase().includes('corte'),
    );
    const ultimoNombre = rows.reduce(
      (acc, r, i) => (r.name.toLowerCase().includes('corte') ? i : acc),
      -1,
    );
    expect(ultimoNombre).toBeLessThan(primerNoNombre);
  });

  it('no devuelve el mismo servicio dos veces aunque encaje por varias etiquetas', async () => {
    const rows = await adapter.search({ texto: 'uñas' }, 8);
    const ids = rows.map((r) => r.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respeta el tope de resultados que fija RF56', async () => {
    const rows = await adapter.search({ texto: 'corte' }, 8);
    expect(rows.length).toBeLessThanOrEqual(8);
    // El término encaja con decenas de servicios: el tope debe estar saturado.
    expect(rows.length).toBe(8);
  });

  it('sin término devuelve catálogo acotado, como antes', async () => {
    const rows = await adapter.search({}, 5);
    expect(rows).toHaveLength(5);
  });
  /** Ids de los servicios que llevan alguna de las etiquetas dadas, leídos de la BD. */
  const idsConEtiqueta = async (nombres: string[]): Promise<Set<string>> => {
    const filas: Array<{ id: string }> = await dataSource.query(
      `SELECT s.id FROM service s
         WHERE EXISTS (
           SELECT 1 FROM service_tags_tag st
           INNER JOIN tag t ON t.id = st."tagId"
           WHERE st."serviceId" = s.id AND t.name = ANY($1))`,
      [nombres],
    );
    return new Set(filas.map((f) => f.id));
  };

  it('encuentra «corte para hombre», la frase que de verdad escribe la clienta', async () => {
    const rows = await adapter.search({ texto: 'corte para hombre' }, 8);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('encuentra «algo barato para las uñas»: el precio no es una palabra del catálogo', async () => {
    const rows = await adapter.search(
      { texto: 'algo barato para las uñas' },
      8,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('exige que encajen todas las palabras con contenido, no solo una', async () => {
    const rows = await adapter.search(
      { texto: 'corte zzzznoexisteestapalabra' },
      8,
    );
    expect(rows).toEqual([]);
  });

  it('una frase hecha solo de palabras vacías equivale a buscar sin texto', async () => {
    const rows = await adapter.search({ texto: 'algo para mí, por favor' }, 5);
    expect(rows).toHaveLength(5);
  });

  it('el género filtra por etiqueta e incluye los unisex en «Hombre»', async () => {
    const permitidos = await idsConEtiqueta(['Hombre', 'Unisex']);
    const soloUnisex = await idsConEtiqueta(['Unisex']);
    const hombre = await idsConEtiqueta(['Hombre']);

    const rows = await adapter.search({ genero: 'Hombre' }, 50);

    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(permitidos.has(r.id)).toBe(true);
    // El catálogo tiene unisex sin etiqueta de hombre: si no apareciera ninguno,
    // el filtro estaría mirando solo la etiqueta literal.
    const unisexPuros = [...soloUnisex].filter((id) => !hombre.has(id));
    expect(unisexPuros.length).toBeGreaterThan(0);
    expect(rows.some((r) => unisexPuros.includes(r.id))).toBe(true);
  });

  it('«Niños» no arrastra los unisex: no todo lo de adultos les sirve', async () => {
    const ninos = await idsConEtiqueta(['Niños']);
    const rows = await adapter.search({ genero: 'Niños' }, 50);

    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(ninos.has(r.id)).toBe(true);
  });

  it('acepta el género aunque el modelo lo escriba sin tilde ni mayúscula', async () => {
    const canonico = await adapter.search({ genero: 'Niños' }, 50);
    const flojo = await adapter.search({ genero: 'ninos' }, 50);
    expect(flojo.map((r) => r.id)).toEqual(canonico.map((r) => r.id));
  });

  it('el precio máximo acota el catálogo', async () => {
    const rows = await adapter.search({ precioMaximo: 30000 }, 8);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.price).toBeLessThanOrEqual(30000);
  });

  it('combina texto, género y presupuesto en una sola consulta', async () => {
    const mujerUnisex = await idsConEtiqueta(['Mujer', 'Unisex']);
    const rows = await adapter.search(
      { texto: 'uñas', genero: 'Mujer', precioMaximo: 60000 },
      8,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(mujerUnisex.has(r.id)).toBe(true);
      expect(r.price).toBeLessThanOrEqual(60000);
    }
  });

  /**
   * Servicios cuyo nombre o alguna etiqueta contiene el término, comparando
   * **sin diacríticos en ambos lados**: es la definición de «encajar» que la
   * clienta tiene en la cabeza cuando teclea desde el móvil sin la ñ.
   */
  const serviciosQueContienen = async (
    termino: string,
  ): Promise<Array<{ id: string; price: number }>> => {
    const filas: Array<{ id: string; price: string }> = await dataSource.query(
      `SELECT s.id, s.price FROM service s
         WHERE translate(s.name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN') ILIKE $1
            OR EXISTS (
              SELECT 1 FROM service_tags_tag st
              INNER JOIN tag t ON t.id = st."tagId"
              WHERE st."serviceId" = s.id
                AND translate(t.name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN') ILIKE $1)`,
      [`%${termino}%`],
    );
    return filas.map((f) => ({ id: f.id, price: Number(f.price) }));
  };

  // ——— Defecto 1: teclear «unas» sin la ñ no puede vaciar el filtro ———

  it('«unas» sin tilde encuentra las uñas, no el catálogo entero', async () => {
    const candidatos = new Set(
      (await serviciosQueContienen('unas')).map((c) => c.id),
    );
    const sinEne = await adapter.search({ texto: 'unas' }, 8);
    const conEne = await adapter.search({ texto: 'uñas' }, 8);

    expect(sinEne).toHaveLength(8);
    // Antes «unas» se leía como el artículo, la consulta degradaba a «sin
    // texto» y encabezaba «360 waves»: intención perdida en silencio.
    for (const r of sinEne) expect(candidatos.has(r.id)).toBe(true);
    expect(sinEne.map((r) => r.id)).toEqual(conEne.map((r) => r.id));
  });

  it('«unas mechas»: ahí «unas» sí es artículo y no debe vaciar el resultado', async () => {
    const mechas = new Set(
      (await serviciosQueContienen('mechas')).map((c) => c.id),
    );
    const rows = await adapter.search({ texto: 'unas mechas' }, 8);

    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(mechas.has(r.id)).toBe(true);
  });

  // ——— Defecto 2: «barato» tiene que ordenar por precio ———

  it('un adjetivo de precio ordena por precio ascendente, no por nombre', async () => {
    const masBaratos = (await serviciosQueContienen('unas'))
      .sort((a, b) => a.price - b.price)
      .slice(0, 8)
      .map((c) => c.price);

    const rows = await adapter.search(
      { texto: 'algo barato para las uñas' },
      8,
    );

    expect(rows.map((r) => r.price)).toEqual(masBaratos);
    // El caso del informe: el más barato salía sexto detrás de los de 78.000.
    expect(rows[0].name).toBe('Esmaltado semipermanente');
  });

  it('«algo barato» sin más concepto devuelve lo más barato del catálogo', async () => {
    const rows = await adapter.search({ texto: 'algo barato' }, 8);
    const precios = rows.map((r) => r.price);

    expect(rows).toHaveLength(8);
    expect([...precios].sort((a, b) => a - b)).toEqual(precios);
  });

  // ——— Defecto 3: el público escrito en la búsqueda es un género ———

  it('buscar «hombre» equivale a filtrar por género Hombre, unisex incluidos', async () => {
    const porTexto = await adapter.search({ texto: 'hombre' }, 50);
    const porFiltro = await adapter.search({ genero: 'Hombre' }, 50);

    expect(porTexto.length).toBeGreaterThan(0);
    expect(porTexto.map((r) => r.id)).toEqual(porFiltro.map((r) => r.id));
  });

  it('«corte para hombre» arrastra los unisex puros, como el filtro de género', async () => {
    const enTexto = await adapter.search({ texto: 'corte para hombre' }, 50);
    const conFiltro = await adapter.search(
      { texto: 'corte', genero: 'Hombre' },
      50,
    );

    expect(enTexto.map((r) => r.id)).toEqual(conFiltro.map((r) => r.id));

    const soloUnisex = await idsConEtiqueta(['Unisex']);
    const hombre = await idsConEtiqueta(['Hombre']);
    const unisexPuros = [...soloUnisex].filter((id) => !hombre.has(id));
    expect(enTexto.some((r) => unisexPuros.includes(r.id))).toBe(true);
  });

  it('el parámetro genero explícito gana sobre el que viene escrito en el texto', async () => {
    const mujerUnisex = await idsConEtiqueta(['Mujer', 'Unisex']);
    const rows = await adapter.search(
      { texto: 'corte para hombre', genero: 'Mujer' },
      50,
    );
    const soloMujer = await adapter.search(
      { texto: 'corte', genero: 'Mujer' },
      50,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(mujerUnisex.has(r.id)).toBe(true);
    expect(rows.map((r) => r.id)).toEqual(soloMujer.map((r) => r.id));
  });

  it('«corte para niños» en el texto tampoco arrastra los unisex', async () => {
    const ninos = await idsConEtiqueta(['Niños']);
    const rows = await adapter.search({ texto: 'corte para niños' }, 50);

    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(ninos.has(r.id)).toBe(true);
  });
});

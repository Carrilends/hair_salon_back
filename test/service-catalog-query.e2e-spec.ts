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

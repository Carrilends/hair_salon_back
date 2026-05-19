/**
 * Runner genérico de inserción de servicios pre-resueltos.
 *
 * Lee `src/service/seed/.resolved-<section>.json` (un array de ResolvedService que
 * produce la skill `seed-section-marlene`) e inserta cada servicio vía repos TypeORM.
 *
 * - NO resuelve tags: confía en `tagIds` ya calculados por la skill.
 * - Idempotente: salta cualquier servicio cuyo `name` (UNIQUE) ya exista y lo reporta.
 * - Guarda contra el bug histórico: aborta ANTES de insertar nada si algún servicio
 *   resuelto no trae un tag de género (hijo de la categoría raíz "Género").
 *
 * Uso: `npm run seed:resolved -- <sectionKey>`
 *   ej. `npm run seed:resolved -- Cortes_hombre_nino`
 *
 * El núcleo (`validateShape`, `runInsert`) se exporta puro y testeable: lanza `Error`
 * en vez de salir del proceso. Solo `bootstrap()` toca Nest / argv / fs / exit.
 */
import { In, type Repository } from 'typeorm';
import { Service } from '../entities/service.entity';
import { Detail } from '../../detail/entities/detail.entity';
import { ImageManager } from '../../images/images.entity';
import { Tag } from '../../tags/entities/tag.entity';

export const PLACEHOLDER_IMAGE = {
  publicId: 'placeholder_marlene',
  version: '0',
  url: 'https://placehold.co/600x400?text=Peluquer%C3%ADa+Marlene',
  isPrincipal: true,
} as const;

export type ResolvedService = {
  name: string;
  type: string;
  price: number;
  duration: number;
  isSpecial: false;
  havePromotion: boolean;
  porcentageDiscount: number;
  description: string;
  tagIds: string[];
};

export type InsertReport = {
  inserted: number;
  skipped: string[];
  genderDist: Record<string, number>;
  fewTags: string[];
};

/** Valida la forma del JSON resuelto. Lanza Error con el motivo exacto. */
export function validateShape(
  list: unknown,
  section: string,
): ResolvedService[] {
  if (!Array.isArray(list))
    throw new Error(`.resolved-${section}.json no es un array`);
  list.forEach((s, i) => {
    const r = s as Partial<ResolvedService>;
    const where = `servicio #${i} ("${r?.name ?? '?'}")`;
    if (!r || typeof r.name !== 'string' || !r.name.trim())
      throw new Error(`${where}: falta "name"`);
    if (typeof r.type !== 'string' || !r.type.trim())
      throw new Error(`${where}: falta "type"`);
    if (typeof r.price !== 'number' || r.price <= 0)
      throw new Error(`${where}: "price" inválido`);
    if (typeof r.duration !== 'number' || r.duration <= 0)
      throw new Error(`${where}: "duration" inválido`);
    if (typeof r.description !== 'string' || !r.description.trim())
      throw new Error(`${where}: falta "description"`);
    if (!Array.isArray(r.tagIds) || r.tagIds.length < 2)
      throw new Error(
        `${where}: "tagIds" debe tener ≥2 entradas (raíz + género)`,
      );
  });
  return list as ResolvedService[];
}

/**
 * Inserta los servicios resueltos. Idempotente por `name`. Lanza Error (sin insertar
 * nada) si falta el tag raíz "Género", si algún servicio no trae género, o si algún
 * tagId no existe en la BD.
 */
export async function runInsert(args: {
  serviceRepo: Repository<Service>;
  tagRepo: Repository<Tag>;
  services: ResolvedService[];
}): Promise<InsertReport> {
  const { serviceRepo, tagRepo, services } = args;

  const generoRoot = await tagRepo.findOne({ where: { name: 'Género' } });
  if (!generoRoot)
    throw new Error(
      'No existe el tag raíz "Género" en la BD. Revisa la taxonomía.',
    );
  const generoTags = await tagRepo.find({ where: { parentId: generoRoot.id } });
  const generoIdToName = new Map(generoTags.map((t) => [t.id, t.name]));

  // GUARD anti-bug: ningún servicio puede quedar sin tag de género.
  const sinGenero = services.filter(
    (s) => !s.tagIds.some((id) => generoIdToName.has(id)),
  );
  if (sinGenero.length)
    throw new Error(
      `${sinGenero.length} servicio(s) resuelto(s) sin tag de género; abortado sin ` +
        `insertar nada. Ej: ${sinGenero
          .slice(0, 5)
          .map((s) => `"${s.name}"`)
          .join(', ')}`,
    );

  // Todos los tagIds referenciados deben existir en la BD.
  const allTagIds = [...new Set(services.flatMap((s) => s.tagIds))];
  const existing = allTagIds.length
    ? await tagRepo.findBy({ id: In(allTagIds) })
    : [];
  const existingIds = new Set(existing.map((t) => t.id));
  const missing = allTagIds.filter((id) => !existingIds.has(id));
  if (missing.length)
    throw new Error(`tagIds inexistentes en la BD: ${missing.join(', ')}`);

  const report: InsertReport = {
    inserted: 0,
    skipped: [],
    genderDist: {},
    fewTags: [],
  };

  for (const r of services) {
    const dup = await serviceRepo.findOne({ where: { name: r.name } });
    if (dup) {
      report.skipped.push(r.name);
      continue;
    }

    const service = serviceRepo.create({
      name: r.name,
      type: r.type,
      price: r.price,
      duration: r.duration,
      isSpecial: false,
      havePromotion: r.havePromotion,
      porcentageDiscount: r.havePromotion ? r.porcentageDiscount : 0,
      tags: r.tagIds.map((id) => ({ id }) as Tag),
      detail: { description: r.description, specifications: {} } as Detail,
      images: [{ ...PLACEHOLDER_IMAGE }] as ImageManager[],
    });
    await serviceRepo.save(service);
    report.inserted++;

    for (const id of r.tagIds) {
      const g = generoIdToName.get(id);
      if (g) report.genderDist[g] = (report.genderDist[g] ?? 0) + 1;
    }
    if (r.tagIds.length < 3) report.fewTags.push(r.name);
  }

  return report;
}

async function bootstrap() {
  const section = process.argv[2];
  if (!section) {
    console.error(
      '✖ Falta el argumento <sectionKey>. Uso: npm run seed:resolved -- <sectionKey>',
    );
    process.exit(1);
  }

  const { join } = await import('path');
  const { readFileSync } = await import('fs');
  const file = join(__dirname, `.resolved-${section}.json`);

  let services: ResolvedService[];
  try {
    services = validateShape(JSON.parse(readFileSync(file, 'utf8')), section);
  } catch (e) {
    console.error(
      `✖ ${(e as Error).message}\n  Archivo esperado: ${file}. ¿La skill ya generó el JSON resuelto?`,
    );
    process.exit(1);
  }

  const { NestFactory } = await import('@nestjs/core');
  const { DataSource } = await import('typeorm');
  const { AppModule } = await import('../../app.module');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const ds = app.get(DataSource);
    const report = await runInsert({
      serviceRepo: ds.getRepository(Service),
      tagRepo: ds.getRepository(Tag),
      services,
    });

    console.log(`\n── Reporte sección "${section}" ──`);
    console.log(`✔ Insertados: ${report.inserted}`);
    console.log(`↷ Saltados (name ya existía): ${report.skipped.length}`);
    if (report.skipped.length)
      console.log(`   ${report.skipped.map((n) => `"${n}"`).join(', ')}`);
    const dist = Object.entries(report.genderDist)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    console.log(`⚥ Distribución de género (insertados): ${dist || '—'}`);
    if (report.fewTags.length)
      console.log(
        `⚠ ${report.fewTags.length} con solo 2 tags (raíz+género, sin específico): ` +
          report.fewTags.map((n) => `"${n}"`).join(', '),
      );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('✖ insert-resolved falló:', err);
    process.exit(1);
  });
}

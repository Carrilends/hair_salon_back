import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { Service } from '../entities/service.entity';
import { Detail } from '../../detail/entities/detail.entity';
import { ImageManager } from '../../images/images.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { chance, randomDuration, randomInt, randomPrice } from './random';
import { PLACEHOLDER_IMAGE } from './placeholder';
import { NEW_TAGS } from './mappings/new-tags';
import { SectionMapping } from './mappings/shared-types';
import seedJson from './seed-services-v2.json';

import { mapping as section1 } from './mappings/section-1-cortes-hombre-nino';
import { mapping as section2 } from './mappings/section-2-cortes-mujer-nina';
import { mapping as section3 } from './mappings/section-3-unas';
import { mapping as section4 } from './mappings/section-4-maquillaje';
import { mapping as section5 } from './mappings/section-5-cejas-pestanas';
import { mapping as section6 } from './mappings/section-6-tinturas';

const SECTIONS: SectionMapping[] = [
  section1,
  section2,
  section3,
  section4,
  section5,
  section6,
];

type RawService = { name: string; description: string; tags: string[] };
type RawJson = Record<string, Record<string, RawService>>;

function resolveTags(
  freeTextTags: string[],
  section: SectionMapping,
  newTagUuidByName: Map<string, string>,
  extras: string[],
): string[] {
  const uuids = new Set<string>(section.rootTagUuids);
  for (const t of freeTextTags) {
    const mapped = section.tagMap[t];
    if (!mapped) continue;
    for (const u of mapped) {
      if (u.startsWith('NEW:')) {
        const id = newTagUuidByName.get(u.slice(4));
        if (id) uuids.add(id);
      } else {
        uuids.add(u);
      }
    }
  }
  for (const e of extras) uuids.add(e);
  return [...uuids];
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const ds = app.get(DataSource);
  const json = seedJson as unknown as RawJson;

  console.log('▶ Insertando / resolviendo tags nuevos…');
  const tagRepo = ds.getRepository(Tag);
  const newTagUuidByName = new Map<string, string>();
  for (const spec of NEW_TAGS) {
    const existing = await tagRepo.findOne({ where: { name: spec.name } });
    if (existing) {
      newTagUuidByName.set(spec.name, existing.id);
      continue;
    }
    const created = tagRepo.create({
      name: spec.name,
      parentId: spec.parentId ?? undefined,
    });
    const saved = await tagRepo.save(created);
    newTagUuidByName.set(spec.name, saved.id);
    console.log(`  + tag nuevo: ${spec.name} → ${saved.id}`);
  }

  const serviceRepo = ds.getRepository(Service);
  let total = 0;

  for (const section of SECTIONS) {
    const raw = json[section.sectionKey];
    if (!raw) throw new Error(`Sección ${section.sectionKey} no encontrada en JSON`);

    for (const [index, item] of Object.entries(raw)) {
      const override = section.perServiceOverrides[Number(index)] ?? {};
      const tagUuids = resolveTags(
        item.tags ?? [],
        section,
        newTagUuidByName,
        override.extraTagUuids ?? [],
      );

      const havePromotion = override.havePromotion ?? chance(0.15);
      const porcentageDiscount = havePromotion
        ? (override.porcentageDiscount ?? randomInt(10, 30, 5))
        : 0;

      const service = serviceRepo.create({
        name: item.name,
        type: section.serviceType,
        price: override.price ?? randomPrice(section.priceRange.min, section.priceRange.max),
        duration:
          override.duration ?? randomDuration(section.durationRange.min, section.durationRange.max),
        isSpecial: false, // decisión #9 — siempre false
        havePromotion,
        porcentageDiscount,
        tags: tagUuids.map((id) => ({ id }) as Tag),
        detail: {
          description: item.description,
          specifications: {}, // decisión #4 — objeto vacío
        } as Detail,
        images: [{ ...PLACEHOLDER_IMAGE }] as ImageManager[],
      });

      await serviceRepo.save(service);
      total++;
    }
    console.log(`  ✓ ${section.sectionKey}: ${Object.keys(raw).length} servicios`);
  }

  console.log(`✔ Total insertados: ${total}`);
  await app.close();
}

bootstrap().catch((err) => {
  console.error('✖ seed falló:', err);
  process.exit(1);
});

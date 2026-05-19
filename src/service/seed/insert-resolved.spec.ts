import { runInsert, validateShape, ResolvedService } from './insert-resolved';

const GENERO_ROOT = 'genero-root-id';
const HOMBRE = 'hombre-id';
const MUJER = 'mujer-id';
const ROOT_CABELLO = 'cabello-root-id';
const DEGRADADO = 'degradado-id';

function svc(over: Partial<ResolvedService> = {}): ResolvedService {
  return {
    name: 'Fade bajo',
    type: 'hair-men',
    price: 30000,
    duration: 45,
    isSpecial: false,
    havePromotion: false,
    porcentageDiscount: 0,
    description: 'desc',
    tagIds: [ROOT_CABELLO, HOMBRE, DEGRADADO],
    ...over,
  };
}

/** tagRepo mock: conoce el root "Género", sus hijos, y un set de tags existentes. */
function makeTagRepo(existingIds: string[]) {
  return {
    findOne: jest.fn(async ({ where }: any) =>
      where?.name === 'Género' ? { id: GENERO_ROOT, name: 'Género' } : null,
    ),
    find: jest.fn(async ({ where }: any) =>
      where?.parentId === GENERO_ROOT
        ? [
            { id: HOMBRE, name: 'Hombre' },
            { id: MUJER, name: 'Mujer' },
          ]
        : [],
    ),
    findBy: jest.fn(async () => existingIds.map((id) => ({ id }))),
  } as any;
}

function makeServiceRepo(existingNames: string[] = []) {
  const saved: any[] = [];
  return {
    saved,
    findOne: jest.fn(async ({ where }: any) =>
      existingNames.includes(where?.name)
        ? { id: 'x', name: where.name }
        : null,
    ),
    create: jest.fn((e: any) => e),
    save: jest.fn(async (e: any) => {
      saved.push(e);
      return e;
    }),
  } as any;
}

describe('validateShape', () => {
  it('rechaza si no es array', () => {
    expect(() => validateShape({}, 'sec')).toThrow(/no es un array/);
  });

  it('rechaza tagIds con menos de 2 entradas', () => {
    expect(() =>
      validateShape([svc({ tagIds: [ROOT_CABELLO] })], 'sec'),
    ).toThrow(/≥2 entradas/);
  });

  it('rechaza price inválido', () => {
    expect(() => validateShape([svc({ price: 0 })], 'sec')).toThrow(/price/);
  });

  it('acepta una lista válida', () => {
    expect(validateShape([svc()], 'sec')).toHaveLength(1);
  });
});

describe('runInsert', () => {
  it('aborta sin insertar si falta el tag raíz "Género"', async () => {
    const tagRepo = {
      findOne: jest.fn(async () => null),
      find: jest.fn(),
      findBy: jest.fn(),
    } as any;
    const serviceRepo = makeServiceRepo();
    await expect(
      runInsert({ serviceRepo, tagRepo, services: [svc()] }),
    ).rejects.toThrow(/raíz "Género"/);
    expect(serviceRepo.save).not.toHaveBeenCalled();
  });

  it('aborta sin insertar si un servicio no trae tag de género', async () => {
    const tagRepo = makeTagRepo([ROOT_CABELLO, DEGRADADO]);
    const serviceRepo = makeServiceRepo();
    await expect(
      runInsert({
        serviceRepo,
        tagRepo,
        services: [svc({ tagIds: [ROOT_CABELLO, DEGRADADO] })],
      }),
    ).rejects.toThrow(/sin tag de género/);
    expect(serviceRepo.save).not.toHaveBeenCalled();
  });

  it('aborta si algún tagId no existe en la BD', async () => {
    const tagRepo = makeTagRepo([ROOT_CABELLO, HOMBRE]); // falta DEGRADADO
    const serviceRepo = makeServiceRepo();
    await expect(
      runInsert({ serviceRepo, tagRepo, services: [svc()] }),
    ).rejects.toThrow(/inexistentes/);
    expect(serviceRepo.save).not.toHaveBeenCalled();
  });

  it('salta servicios cuyo name ya existe e inserta el resto', async () => {
    const tagRepo = makeTagRepo([ROOT_CABELLO, HOMBRE, MUJER, DEGRADADO]);
    const serviceRepo = makeServiceRepo(['Ya existe']);
    const report = await runInsert({
      serviceRepo,
      tagRepo,
      services: [
        svc({ name: 'Ya existe' }),
        svc({ name: 'Nuevo 1', tagIds: [ROOT_CABELLO, HOMBRE, DEGRADADO] }),
        svc({ name: 'Nuevo 2', tagIds: [ROOT_CABELLO, MUJER] }),
      ],
    });

    expect(report.inserted).toBe(2);
    expect(report.skipped).toEqual(['Ya existe']);
    expect(report.genderDist).toEqual({ Hombre: 1, Mujer: 1 });
    expect(report.fewTags).toEqual(['Nuevo 2']); // solo raíz+género
    expect(serviceRepo.save).toHaveBeenCalledTimes(2);
  });

  it('enlaza tagIds como referencias {id} y crea detail + imagen placeholder', async () => {
    const tagRepo = makeTagRepo([ROOT_CABELLO, HOMBRE, DEGRADADO]);
    const serviceRepo = makeServiceRepo();
    await runInsert({ serviceRepo, tagRepo, services: [svc()] });

    const built = serviceRepo.saved[0];
    expect(built.tags).toEqual([
      { id: ROOT_CABELLO },
      { id: HOMBRE },
      { id: DEGRADADO },
    ]);
    expect(built.detail.specifications).toEqual({});
    expect(built.images[0].publicId).toBe('placeholder_marlene');
    expect(built.isSpecial).toBe(false);
  });
});

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReordenarFaqsDto } from './reordenar-faqs.dto';

const A = '3f1c2b9e-8a4d-4c1e-9b7a-1d2e3f4a5b6c';
const B = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';

/** Mismas opciones que la `ValidationPipe` global de `main.ts`. */
const validar = (cuerpo: object) =>
  validate(plainToInstance(ReordenarFaqsDto, cuerpo), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

/** Los nombres de las reglas que fallaron, de todas las propiedades. */
const fallos = async (cuerpo: object) =>
  (await validar(cuerpo)).flatMap((error) =>
    Object.keys(error.constraints ?? {}),
  );

describe('ReordenarFaqsDto', () => {
  it('admite la lista de ids en el orden deseado', async () => {
    expect(await validar({ ids: [A, B] })).toHaveLength(0);
  });

  it('rechaza que falte la lista', async () => {
    expect(await fallos({})).toContain('isArray');
  });

  it('rechaza un id suelto en lugar de una lista', async () => {
    expect(await fallos({ ids: A })).toContain('isArray');
  });

  it('rechaza una lista vacía', async () => {
    expect(await fallos({ ids: [] })).toContain('arrayNotEmpty');
  });

  it('rechaza ids repetidos', async () => {
    expect(await fallos({ ids: [A, A] })).toContain('arrayUnique');
  });

  it('rechaza lo que no es un uuid', async () => {
    expect(await fallos({ ids: [A, 'orden'] })).toContain('isUuid');
  });

  it('rechaza una lista desmesurada', async () => {
    const muchos = Array.from(
      { length: 501 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );
    expect(await fallos({ ids: muchos })).toContain('arrayMaxSize');
  });

  it('rechaza campos de más', async () => {
    expect(await fallos({ ids: [A], sortOrder: 3 })).toContain(
      'whitelistValidation',
    );
  });
});

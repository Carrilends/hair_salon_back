import { plainToInstance } from 'class-transformer';
import { useContainer, validate } from 'class-validator';
import { CreateServiceDto } from './create-service.dto';
import { AlreadyExistOnePrincipalConstraint } from '../validators/customValidators';

// La restricción asíncrona pide el repositorio por inyección; aquí uno vacío.
const repoVacio = {
  createQueryBuilder: () => ({
    where: () => ({ getMany: async () => [] }),
  }),
};
useContainer(
  {
    get: (cls: new (...args: unknown[]) => unknown) =>
      cls === AlreadyExistOnePrincipalConstraint
        ? new AlreadyExistOnePrincipalConstraint(repoVacio as never)
        : new cls(),
  },
  { fallbackOnErrors: true },
);

const erroresDeImagenes = async (images: object[]) => {
  const dto = plainToInstance(CreateServiceDto, {
    name: 'Corte',
    price: 10000,
    duration: 30,
    images,
  });
  const errores = await validate(dto);
  return errores.filter((e) => e.property === 'images');
};

describe('CreateServiceDto · imágenes', () => {
  // La principal la decide el servidor (`selectPrincipalImage`): el front ya
  // no marca ninguna al subir. Exigir una marcada rompía el alta de servicios.
  it('acepta imágenes sin ninguna marcada como principal', async () => {
    expect(
      await erroresDeImagenes([
        { url: 'https://img.test/a', isPrincipal: false },
        { url: 'https://img.test/b', isPrincipal: false },
      ]),
    ).toEqual([]);
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignDto } from './sign.dto';

describe('SignDto', () => {
  it('acepta un cuerpo vacío (todos los campos son opcionales)', async () => {
    const errors = await validate(plainToInstance(SignDto, {}));
    expect(errors).toHaveLength(0);
  });

  it('acepta parámetros de firma válidos', async () => {
    const errors = await validate(
      plainToInstance(SignDto, {
        folder: 'servicios',
        tags: ['destacado', 'corte'],
        overwrite: true,
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rechaza overwrite que no es booleano', async () => {
    const errors = await validate(
      plainToInstance(SignDto, { overwrite: 'sí' }),
    );
    expect(errors.find((e) => e.property === 'overwrite')?.constraints).toHaveProperty(
      'isBoolean',
    );
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateEmailDto } from './update-email.dto';

const buildDto = (overrides: Partial<UpdateEmailDto> = {}) =>
  plainToInstance(UpdateEmailDto, {
    newEmail: 'nuevo@correo.com',
    // Contraseña ACTUAL: solo se verifica con bcrypt, no se le aplica la
    // política de creación. Sin símbolo debe ser aceptada por el DTO.
    currentPassword: 'Marlene2024',
    ...overrides,
  });

const constraintsFor = (
  errors: Awaited<ReturnType<typeof validate>>,
  field: string,
) => errors.find((e) => e.property === field)?.constraints ?? {};

describe('UpdateEmailDto', () => {
  it('acepta una contraseña ACTUAL sin símbolo (credencial a verificar)', async () => {
    const errors = await validate(buildDto());
    expect(Object.keys(constraintsFor(errors, 'currentPassword'))).toHaveLength(
      0,
    );
  });

  it('rechaza un correo nuevo mal formado', async () => {
    const errors = await validate(buildDto({ newEmail: 'not-an-email' }));
    expect(constraintsFor(errors, 'newEmail')).toHaveProperty('isEmail');
  });
});

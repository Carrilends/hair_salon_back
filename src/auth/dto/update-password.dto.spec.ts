import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePasswordDto } from './update-password.dto';

const buildDto = (overrides: Partial<UpdatePasswordDto> = {}) =>
  plainToInstance(UpdatePasswordDto, {
    // La contraseña ACTUAL solo se verifica con bcrypt; no se le aplica la
    // política de creación. Sin símbolo debe ser aceptada por el DTO.
    currentPassword: 'Marlene2024',
    // La contraseña NUEVA sí cumple la política vigente (min. 8 + mayúscula +
    // minúscula + número, sin símbolo obligatorio).
    newPassword: 'Marlene2025',
    ...overrides,
  });

const constraintsFor = (
  errors: Awaited<ReturnType<typeof validate>>,
  field: string,
) => errors.find((e) => e.property === field)?.constraints ?? {};

describe('UpdatePasswordDto', () => {
  it('acepta una contraseña ACTUAL sin símbolo (credencial a verificar)', async () => {
    const errors = await validate(buildDto());
    expect(Object.keys(constraintsFor(errors, 'currentPassword'))).toHaveLength(
      0,
    );
  });

  it('acepta una contraseña NUEVA fuerte sin símbolo', async () => {
    const errors = await validate(buildDto());
    expect(Object.keys(constraintsFor(errors, 'newPassword'))).toHaveLength(0);
  });

  it('rechaza una contraseña NUEVA sin mayúscula', async () => {
    const errors = await validate(buildDto({ newPassword: 'marlene2025' }));
    expect(constraintsFor(errors, 'newPassword')).toHaveProperty(
      'isStrongPassword',
    );
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResetPasswordDto } from './reset-password.dto';

const buildDto = (overrides: Partial<ResetPasswordDto> = {}) =>
  plainToInstance(ResetPasswordDto, {
    token: 'a'.repeat(43), // token de 32 bytes en base64url
    // Política vigente: min. 8 + mayúscula + minúscula + número, SIN símbolo.
    newPassword: 'Marlene2024',
    ...overrides,
  });

const constraintsFor = (
  errors: Awaited<ReturnType<typeof validate>>,
  field: string,
) => errors.find((e) => e.property === field)?.constraints ?? {};

describe('ResetPasswordDto', () => {
  it('acepta una contraseña nueva fuerte sin símbolo', async () => {
    const errors = await validate(buildDto());
    expect(errors).toHaveLength(0);
  });

  it('rechaza una contraseña nueva sin número', async () => {
    const errors = await validate(buildDto({ newPassword: 'MarleneSopo' }));
    expect(constraintsFor(errors, 'newPassword')).toHaveProperty(
      'isStrongPassword',
    );
  });

  it('rechaza un token demasiado corto', async () => {
    const errors = await validate(buildDto({ token: 'corto' }));
    expect(constraintsFor(errors, 'token')).toHaveProperty('minLength');
  });
});

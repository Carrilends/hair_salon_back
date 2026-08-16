import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginUserDto } from './login-user.dto';

const buildDto = (overrides: Partial<LoginUserDto> = {}) =>
  plainToInstance(LoginUserDto, {
    email: 'jane.doe@example.com',
    password: 'Marlene2024',
    ...overrides,
  });

const constraintsFor = (
  errors: Awaited<ReturnType<typeof validate>>,
  field: string,
) => errors.find((e) => e.property === field)?.constraints ?? {};

describe('LoginUserDto', () => {
  it('acepta una contraseña sin símbolo: es la credencial a verificar, no a crear', async () => {
    const errors = await validate(buildDto());
    expect(errors).toHaveLength(0);
  });

  it('rechaza una contraseña ausente', async () => {
    const errors = await validate(buildDto({ password: '' }));
    expect(Object.keys(constraintsFor(errors, 'password'))).not.toHaveLength(0);
  });

  it('rechaza email mal formado', async () => {
    const errors = await validate(buildDto({ email: 'not-an-email' }));
    expect(constraintsFor(errors, 'email')).toHaveProperty('isEmail');
  });
});

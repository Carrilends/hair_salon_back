import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

const buildDto = (overrides: Partial<CreateUserDto> = {}) =>
  plainToInstance(CreateUserDto, {
    email: 'jane.doe@example.com',
    password: 'Str0ngP@ssw0rd!',
    fullName: 'Jane Doe',
    ...overrides,
  });

const constraintsFor = (errors: Awaited<ReturnType<typeof validate>>, field: string) =>
  errors.find((e) => e.property === field)?.constraints ?? {};

describe('CreateUserDto (NF05 — validación de datos de entrada)', () => {
  it('Caso 1: acepta un payload válido', async () => {
    const errors = await validate(buildDto());
    expect(errors).toHaveLength(0);
  });

  it('Caso 2: rechaza email mal formado', async () => {
    const errors = await validate(buildDto({ email: 'not-an-email' }));
    expect(constraintsFor(errors, 'email')).toHaveProperty('isEmail');
  });

  it('Caso 3: rechaza password con menos de 8 caracteres', async () => {
    const errors = await validate(buildDto({ password: 'A1!a' }));
    expect(constraintsFor(errors, 'password')).toHaveProperty('minLength');
  });

  it('Caso 4: rechaza password débil (sin mayúsculas/símbolos/dígitos)', async () => {
    const errors = await validate(buildDto({ password: 'abcdefghij' }));
    expect(constraintsFor(errors, 'password')).toHaveProperty('isStrongPassword');
  });

  it('Caso 5: rechaza fullName que no es string', async () => {
    const errors = await validate(buildDto({ fullName: 12345 as unknown as string }));
    expect(constraintsFor(errors, 'fullName')).toHaveProperty('isString');
  });
});

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const UUID_B = '550e8400-e29b-41d4-a716-446655440001';

const buildDto = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(CreateReservationDto, {
    scheduledAt: '2026-05-06T15:00:00.000Z',
    serviceIds: [UUID_A, UUID_B],
    workerId: UUID_A,
    ...overrides,
  });

const constraintsFor = (
  errors: Awaited<ReturnType<typeof validate>>,
  field: string,
) => errors.find((e) => e.property === field)?.constraints ?? {};

describe('CreateReservationDto (NF05 — validación de datos de entrada)', () => {
  it('Caso 1: acepta un payload válido', async () => {
    const errors = await validate(buildDto());
    expect(errors).toHaveLength(0);
  });

  it('Caso 2: rechaza scheduledAt sin formato ISO 8601', async () => {
    const errors = await validate(buildDto({ scheduledAt: '06/05/2026 15:00' }));
    expect(constraintsFor(errors, 'scheduledAt')).toHaveProperty('isIso8601');
  });

  it('Caso 3: rechaza serviceIds vacío', async () => {
    const errors = await validate(buildDto({ serviceIds: [] }));
    expect(constraintsFor(errors, 'serviceIds')).toHaveProperty('arrayMinSize');
  });

  it('Caso 4: rechaza serviceIds con un UUID malformado', async () => {
    const errors = await validate(buildDto({ serviceIds: ['not-a-uuid'] }));
    expect(constraintsFor(errors, 'serviceIds')).toHaveProperty('isUuid');
  });

  it('Caso 5: rechaza workerId con UUID malformado', async () => {
    const errors = await validate(buildDto({ workerId: 'not-a-uuid' }));
    expect(constraintsFor(errors, 'workerId')).toHaveProperty('isUuid');
  });

  it('Caso 6: acepta payload sin workerId (campo opcional)', async () => {
    const dto = buildDto();
    delete (dto as Partial<CreateReservationDto>).workerId;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('Caso 7: acepta contacto válido para reserva anónima', async () => {
    const errors = await validate(
      buildDto({ contact: { name: 'Ana', phone: '3001234567' } }),
    );
    expect(errors).toHaveLength(0);
  });

  it('Caso 8: rechaza un contacto con teléfono demasiado corto', async () => {
    const errors = await validate(
      buildDto({ contact: { name: 'Ana', phone: '12' } }),
    );
    expect(errors.some((e) => e.property === 'contact')).toBe(true);
  });
});

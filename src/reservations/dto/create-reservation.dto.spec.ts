import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReservationDto } from './create-reservation.dto';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const buildDto = (overrides: Partial<CreateReservationDto> = {}) =>
  plainToInstance(CreateReservationDto, {
    scheduledAt: '2026-05-06T15:00:00.000Z',
    totalDurationMinutes: 30,
    workerId: VALID_UUID,
    ...overrides,
  });

const constraintsFor = (errors: Awaited<ReturnType<typeof validate>>, field: string) =>
  errors.find((e) => e.property === field)?.constraints ?? {};

describe('CreateReservationDto (NF05 — validación de datos de entrada)', () => {
  it('Caso 1: acepta un payload válido', async () => {
    const errors = await validate(buildDto());
    expect(errors).toHaveLength(0);
  });

  it('Caso 2: rechaza scheduledAt sin formato ISO 8601', async () => {
    const errors = await validate(buildDto({ scheduledAt: '06/05/2026 15:00' }));
    expect(constraintsFor(errors, 'scheduledAt')).toHaveProperty('isIso8601');
  });

  it('Caso 3: rechaza totalDurationMinutes no entero', async () => {
    const errors = await validate(buildDto({ totalDurationMinutes: 30.5 }));
    expect(constraintsFor(errors, 'totalDurationMinutes')).toHaveProperty('isInt');
  });

  it('Caso 4: rechaza totalDurationMinutes menor que 1', async () => {
    const errors = await validate(buildDto({ totalDurationMinutes: 0 }));
    expect(constraintsFor(errors, 'totalDurationMinutes')).toHaveProperty('min');
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
});

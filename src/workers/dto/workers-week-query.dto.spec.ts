import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorkersWeekQueryDto } from './workers-week-query.dto';

/**
 * `start` acaba en un `::date` de Postgres. Si el DTO dejara pasar un 30 de
 * febrero o una fecha con hora, la base respondería con un error y la dueña
 * vería un 500 en vez de un 400.
 */
const errores = (cuerpo: object) =>
  validate(plainToInstance(WorkersWeekQueryDto, cuerpo));

describe('WorkersWeekQueryDto', () => {
  it('acepta una fecha YYYY-MM-DD real', async () => {
    expect(await errores({ start: '2026-10-07' })).toHaveLength(0);
  });

  it('acepta el 29 de febrero de un año bisiesto', async () => {
    expect(await errores({ start: '2024-02-29' })).toHaveLength(0);
  });

  it('rechaza un día que no existe (30 de febrero)', async () => {
    const [error] = await errores({ start: '2026-02-30' });
    expect(error?.property).toBe('start');
    expect(error?.constraints).toHaveProperty('isDateString');
  });

  it('rechaza el mes o el día sin cero a la izquierda', async () => {
    const [error] = await errores({ start: '2026-1-5' });
    expect(error?.constraints).toHaveProperty('matches');
  });

  it('rechaza una fecha con hora', async () => {
    const [error] = await errores({ start: '2026-10-07T00:00:00Z' });
    expect(error?.constraints).toHaveProperty('matches');
  });

  it('exige start', async () => {
    const [error] = await errores({});
    expect(error?.property).toBe('start');
  });
});

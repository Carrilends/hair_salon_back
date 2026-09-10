import { getDatePartsInTz, salonLocalToUtcIso } from './salon-time';

const TZ = 'America/Bogota'; // UTC-5 todo el año

describe('salonLocalToUtcIso', () => {
  it('convierte una hora del salón al instante UTC correcto', () => {
    // 15:30 en Bogotá (UTC-5) son las 20:30 UTC del mismo día.
    expect(salonLocalToUtcIso('2026-09-12', '15:30', TZ)).toBe(
      '2026-09-12T20:30:00.000Z',
    );
  });

  it('cruza al día siguiente cuando toca', () => {
    // 20:00 en Bogotá son las 01:00 UTC del día siguiente.
    expect(salonLocalToUtcIso('2026-09-12', '20:00', TZ)).toBe(
      '2026-09-13T01:00:00.000Z',
    );
  });

  it('honra la zona que se le pasa, no la del servidor', () => {
    // Es el error que este helper existe para evitar: `new Date('...T15:30')`
    // interpreta la hora en la zona de la MÁQUINA, que en Railway es UTC y en un
    // portátil colombiano es UTC-5, así que el mismo código daría resultados
    // distintos según dónde corriera. Aquí la zona es un argumento explícito.
    expect(salonLocalToUtcIso('2026-09-12', '15:30', 'UTC')).toBe(
      '2026-09-12T15:30:00.000Z',
    );
    expect(salonLocalToUtcIso('2026-09-12', '15:30', 'America/Bogota')).toBe(
      '2026-09-12T20:30:00.000Z',
    );
    expect(salonLocalToUtcIso('2026-09-12', '15:30', 'Asia/Tokyo')).toBe(
      '2026-09-12T06:30:00.000Z',
    );
  });

  it('es la inversa exacta de getDatePartsInTz', () => {
    const iso = salonLocalToUtcIso('2026-09-12', '08:00', TZ);
    const partes = getDatePartsInTz(new Date(iso!), TZ);

    expect(partes).toMatchObject({
      year: 2026,
      month: 9,
      day: 12,
      hour: 8,
      minute: 0,
    });
  });

  it.each([
    ['08:00', '2026-09-12T13:00:00.000Z'],
    ['00:00', '2026-09-12T05:00:00.000Z'],
    ['23:59', '2026-09-13T04:59:00.000Z'],
  ])('convierte %s correctamente', (hhmm, esperado) => {
    expect(salonLocalToUtcIso('2026-09-12', hhmm, TZ)).toBe(esperado);
  });

  it.each([
    ['fecha con formato de calendario', '2026/09/12', '15:30'],
    ['fecha incompleta', '2026-9-1', '15:30'],
    ['día que no existe', '2026-02-31', '15:30'],
    ['mes fuera de rango', '2026-13-01', '15:30'],
    ['hora sin ceros', '2026-09-12', '9:30'],
    ['hora fuera de rango', '2026-09-12', '25:00'],
    ['minuto fuera de rango', '2026-09-12', '10:99'],
    ['basura', 'ayer', 'tarde'],
  ])('devuelve null ante %s', (_caso, fecha, hora) => {
    expect(salonLocalToUtcIso(fecha, hora, TZ)).toBeNull();
  });
});

import { freeStartTimes, formatHumanTime } from './slot-options';

// Lunes: 08:00–20:00 → 480–1200 minutos.
const DIA_ENTRE_SEMANA = {
  effectiveStartMin: 480,
  closeMin: 1200,
  busyBlocks: [],
};

describe('freeStartTimes', () => {
  it('ofrece horas en punto y medias desde la apertura', () => {
    const horas = freeStartTimes(DIA_ENTRE_SEMANA, 30);
    expect(horas.slice(0, 4)).toEqual(['08:00', '08:30', '09:00', '09:30']);
  });

  it('una cita puede terminar JUSTO en el cierre, pero no pasarse', () => {
    const horas = freeStartTimes(DIA_ENTRE_SEMANA, 60);
    expect(horas.at(-1)).toBe('19:00'); // 19:00 + 60 = 20:00 = cierre
  });

  it('la duración manda: una cita larga tiene menos horas posibles', () => {
    // Es la diferencia con la disponibilidad orientativa del asistente, que
    // ofrece franjas de 30 min sueltas: aquí la clienta pulsa y espera que
    // funcione.
    const cortas = freeStartTimes(DIA_ENTRE_SEMANA, 30);
    const largas = freeStartTimes(DIA_ENTRE_SEMANA, 180);
    expect(largas.length).toBeLessThan(cortas.length);
    expect(largas.at(-1)).toBe('17:00'); // 17:00 + 180 = 20:00
  });

  it('descarta las horas que se solapan con un bloque ocupado', () => {
    const horas = freeStartTimes(
      { ...DIA_ENTRE_SEMANA, busyBlocks: [{ startMin: 600, endMin: 660 }] },
      30,
    );
    expect(horas).not.toContain('10:00'); // 600
    expect(horas).not.toContain('10:30'); // 630
    expect(horas).toContain('09:30'); // 570 + 30 = 600, justo pega
    expect(horas).toContain('11:00'); // 660
  });

  it('una cita larga se descarta aunque solo roce el final de un bloque', () => {
    const horas = freeStartTimes(
      { ...DIA_ENTRE_SEMANA, busyBlocks: [{ startMin: 660, endMin: 720 }] },
      120,
    );
    // 10:00 + 120 = 12:00, que pisa el bloque de 11:00 a 12:00.
    expect(horas).not.toContain('10:00');
    expect(horas).toContain('12:00');
  });

  it('parte de la primera media hora completa cuando el día ya empezó', () => {
    // `effectiveStartMin` viene recortado contra la hora actual si es hoy: no
    // tiene sentido ofrecer las 10:07.
    const horas = freeStartTimes(
      { ...DIA_ENTRE_SEMANA, effectiveStartMin: 607 },
      30,
    );
    expect(horas[0]).toBe('10:30');
  });

  it('devuelve vacío si no cabe nada', () => {
    expect(freeStartTimes(DIA_ENTRE_SEMANA, 800)).toEqual([]);
    expect(freeStartTimes(DIA_ENTRE_SEMANA, 0)).toEqual([]);
    expect(
      freeStartTimes(
        { effectiveStartMin: 1180, closeMin: 1200, busyBlocks: [] },
        60,
      ),
    ).toEqual([]);
  });
});

describe('formatHumanTime', () => {
  it.each([
    ['08:00', '8:00 a. m.'],
    ['00:30', '12:30 a. m.'],
    ['12:00', '12:00 p. m.'],
    ['15:30', '3:30 p. m.'],
    ['19:00', '7:00 p. m.'],
  ])('lee %s como %s', (hhmm, esperado) => {
    expect(formatHumanTime(hhmm)).toBe(esperado);
  });
});

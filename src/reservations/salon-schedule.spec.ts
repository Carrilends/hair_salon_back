import {
  WEEKDAY_CLOSE_MIN,
  WEEKDAY_OPEN_MIN,
  WEEKEND_CLOSE_MIN,
  WEEKEND_OPEN_MIN,
  isColombianHolidayYmd,
  isWeekendYmd,
  laborMinutesForCalendarDay,
  usesWeekendHoursYmd,
} from './salon-schedule';

/**
 * Listas de referencia de los festivos colombianos, escritas a mano a partir
 * del calendario publicado (Ley 51 de 1983, «Ley Emiliani») y NO generadas por
 * el propio cálculo: si se generaran con el mismo algoritmo que se prueba, el
 * test no comprobaría nada. Tres años porque una lista fija caduca en silencio
 * y el objetivo es que el cálculo sea tan auditable como una lista sin heredar
 * su fecha de caducidad.
 *
 * Colombia tiene 18 festivos al año; si alguna lista no suma 18, algo falta.
 */
const FESTIVOS_2026 = [
  '2026-01-01', // Año Nuevo (fijo, jueves)
  '2026-01-12', // Reyes Magos (6 ene, martes → lunes 12)
  '2026-03-23', // San José (19 mar, jueves → lunes 23)
  '2026-04-02', // Jueves Santo (Pascua 5 abr − 3)
  '2026-04-03', // Viernes Santo (Pascua − 2)
  '2026-05-01', // Día del Trabajo (fijo, viernes)
  '2026-05-18', // Ascensión (Pascua + 43)
  '2026-06-08', // Corpus Christi (Pascua + 64)
  '2026-06-15', // Sagrado Corazón (Pascua + 71)
  '2026-06-29', // San Pedro y San Pablo (ya cae lunes: no se traslada)
  '2026-07-20', // Independencia (fijo, lunes)
  '2026-08-07', // Batalla de Boyacá (fijo, viernes)
  '2026-08-17', // Asunción (15 ago, sábado → lunes 17)
  '2026-10-12', // Día de la Raza (ya cae lunes)
  '2026-11-02', // Todos los Santos (1 nov, domingo → lunes 2)
  '2026-11-16', // Independencia de Cartagena (11 nov, miércoles → lunes 16)
  '2026-12-08', // Inmaculada Concepción (fijo, martes)
  '2026-12-25', // Navidad (fijo, viernes)
];

const FESTIVOS_2027 = [
  '2027-01-01',
  '2027-01-11', // Reyes (6 ene miércoles → lunes 11)
  '2027-03-22', // San José (19 mar viernes → lunes 22)
  '2027-03-25', // Jueves Santo (Pascua 28 mar − 3)
  '2027-03-26', // Viernes Santo
  '2027-05-01', // Trabajo (fijo, cae sábado y NO se traslada)
  '2027-05-10', // Ascensión
  '2027-05-31', // Corpus Christi
  '2027-06-07', // Sagrado Corazón
  '2027-07-05', // San Pedro y San Pablo (29 jun martes → lunes 5 jul)
  '2027-07-20',
  '2027-08-07', // Boyacá (fijo, cae sábado)
  '2027-08-16', // Asunción (15 ago domingo → lunes 16)
  '2027-10-18', // Raza (12 oct martes → lunes 18)
  '2027-11-01', // Todos los Santos (ya cae lunes)
  '2027-11-15', // Cartagena (11 nov jueves → lunes 15)
  '2027-12-08',
  '2027-12-25', // Navidad (fijo, cae sábado)
];

const FESTIVOS_2028 = [
  '2028-01-01', // cae sábado; fijo, no se traslada
  '2028-01-10', // Reyes (6 ene jueves → lunes 10)
  '2028-03-20', // San José (19 mar domingo → lunes 20)
  '2028-04-13', // Jueves Santo (Pascua 16 abr − 3)
  '2028-04-14', // Viernes Santo
  '2028-05-01', // Trabajo (cae lunes)
  '2028-05-29', // Ascensión
  '2028-06-19', // Corpus Christi
  '2028-06-26', // Sagrado Corazón
  '2028-07-03', // San Pedro y San Pablo (29 jun jueves → lunes 3 jul)
  '2028-07-20',
  '2028-08-07', // Boyacá (cae lunes)
  '2028-08-21', // Asunción (15 ago martes → lunes 21)
  '2028-10-16', // Raza (12 oct jueves → lunes 16)
  '2028-11-06', // Todos los Santos (1 nov miércoles → lunes 6)
  '2028-11-13', // Cartagena (11 nov sábado → lunes 13)
  '2028-12-08',
  '2028-12-25', // Navidad (cae lunes)
];

function partes(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split('-').map(Number);
  return [y, m, d];
}

/** Todos los días del año como `YYYY-MM-DD`, para barrer el calendario entero. */
function diasDelAnio(year: number): string[] {
  const out: string[] = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  while (cursor.getUTCFullYear() === year) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

describe('Festivos colombianos (Ley Emiliani)', () => {
  const porAnio: [number, string[]][] = [
    [2026, FESTIVOS_2026],
    [2027, FESTIVOS_2027],
    [2028, FESTIVOS_2028],
  ];

  it.each(porAnio)(
    'el calendario de %i coincide exactamente con la lista de referencia',
    (year, esperados) => {
      expect(esperados).toHaveLength(18);
      const calculados = diasDelAnio(year as number).filter((ymd) =>
        isColombianHolidayYmd(...partes(ymd)),
      );
      // Igualdad exacta en los dos sentidos: ni uno de más ni uno de menos.
      expect(calculados).toEqual(esperados);
    },
  );

  describe('casos frontera del traslado', () => {
    it('un festivo trasladable que YA cae en lunes se queda donde está', () => {
      // 29 jun 2026 es lunes: el festivo es ese día, no el 6 de julio.
      expect(isColombianHolidayYmd(2026, 6, 29)).toBe(true);
      expect(isColombianHolidayYmd(2026, 7, 6)).toBe(false);
    });

    it('un festivo trasladable en domingo se corre al lunes siguiente', () => {
      // 1 nov 2026 (Todos los Santos) cae domingo → lunes 2.
      expect(isColombianHolidayYmd(2026, 11, 1)).toBe(false);
      expect(isColombianHolidayYmd(2026, 11, 2)).toBe(true);
    });

    it('un festivo de fecha fija NO se traslada aunque caiga en sábado', () => {
      // 1 may 2027 cae sábado y sigue siendo el 1, no el lunes 3.
      expect(isColombianHolidayYmd(2027, 5, 1)).toBe(true);
      expect(isColombianHolidayYmd(2027, 5, 3)).toBe(false);
    });

    it('Jueves y Viernes Santo no se trasladan: dependen de la Pascua', () => {
      expect(isColombianHolidayYmd(2026, 4, 2)).toBe(true);
      expect(isColombianHolidayYmd(2026, 4, 3)).toBe(true);
      // El Domingo de Pascua no es festivo de ley (ya es domingo).
      expect(isColombianHolidayYmd(2026, 4, 5)).toBe(false);
    });

    it('un día laborable corriente no es festivo', () => {
      // Martes 7 de abril de 2026: ni fin de semana ni festivo.
      expect(isColombianHolidayYmd(2026, 4, 7)).toBe(false);
      expect(isWeekendYmd(2026, 4, 7)).toBe(false);
    });
  });
});

describe('Horario del salón en festivo', () => {
  it('un festivo en día laborable usa horario de fin de semana (09:00–19:00)', () => {
    // 2 nov 2026 es lunes festivo: debe abrir como sábado, no como lunes.
    expect(usesWeekendHoursYmd(2026, 11, 2)).toBe(true);
    expect(laborMinutesForCalendarDay(2026, 11, 2)).toBe(
      WEEKEND_CLOSE_MIN - WEEKEND_OPEN_MIN,
    );
  });

  it('el lunes anterior, que no es festivo, sigue con horario de entre semana', () => {
    // 26 oct 2026, lunes corriente.
    expect(usesWeekendHoursYmd(2026, 10, 26)).toBe(false);
    expect(laborMinutesForCalendarDay(2026, 10, 26)).toBe(
      WEEKDAY_CLOSE_MIN - WEEKDAY_OPEN_MIN,
    );
  });

  it('sábado y domingo siguen usando el horario reducido', () => {
    expect(usesWeekendHoursYmd(2026, 4, 11)).toBe(true); // sábado
    expect(usesWeekendHoursYmd(2026, 4, 12)).toBe(true); // domingo
  });
});

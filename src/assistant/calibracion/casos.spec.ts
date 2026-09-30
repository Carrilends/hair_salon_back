import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Los casos etiquetados son **la evidencia** de la que salen los umbrales del
 * código y las cifras que va a citar la tesis. Un caso incoherente no rompe
 * ninguna ejecución: envenena una conclusión, en silencio, y ya pasó dos veces
 * —fechas que no cuadraban con el calendario de 2026, y ganadores colocados en
 * el primer puesto, que puntúan bien incluso con el proveedor caído porque la
 * reordenación es estable—. Estas comprobaciones son la red para la tercera.
 */
const DIRECTORIO = join(__dirname, 'casos');

const bancos = readdirSync(DIRECTORIO)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({
    fichero: f,
    banco: JSON.parse(readFileSync(join(DIRECTORIO, f), 'utf8')) as {
      juicio: string;
      nota: string;
      casos: Record<string, unknown>[];
    },
  }));

/** Etiquetas válidas de cada banco, en el mismo orden que `banco-jev.ts`. */
const ETIQUETAS: Record<string, string[]> = {
  pertinencia: ['atender', 'rechazar'],
  correspondencia: ['corresponde', 'desviada'],
  progreso: ['avanza', 'atascado'],
  relevancia: ['primero', 'falla'],
  balance: ['acierta', 'falla'],
};

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};
const DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

describe('bancos de casos etiquetados', () => {
  it('hay un banco por juicio del runner', () => {
    expect(bancos.map((b) => b.banco.juicio).sort()).toEqual(
      Object.keys(ETIQUETAS).sort(),
    );
  });

  describe.each(bancos)('$fichero', ({ banco }) => {
    it('todos los casos llevan clase, motivo y una etiqueta válida', () => {
      for (const caso of banco.casos) {
        expect(typeof caso.clase).toBe('string');
        expect(typeof caso.por).toBe('string');
        expect(ETIQUETAS[banco.juicio]).toContain(caso.esperado);
      }
    });

    it('no hay casos duplicados', () => {
      const huellas = banco.casos.map((c) => JSON.stringify({ ...c, por: '' }));

      expect(new Set(huellas).size).toBe(huellas.length);
    });
  });
});

describe('correspondencia: las fechas cuadran con el calendario', () => {
  const banco = bancos.find((b) => b.banco.juicio === 'correspondencia')!.banco;

  it.each(banco.casos.map((c) => [c.fecha as string, c.por as string]))(
    '«%s» es ese día de la semana',
    (fecha) => {
      // `\w` con la marca `u` sigue siendo ASCII, así que no encaja «sábado»
      // ni «miércoles»: hacen falta clases Unicode de verdad.
      const m = /^(\p{L}+) (\d+) de (\p{L}+) de (\d+)$/u.exec(fecha);
      expect(m).not.toBeNull();
      const [, dia, numero, mes, anio] = m!;
      const real = new Date(
        Date.UTC(Number(anio), MESES[mes] - 1, Number(numero)),
      );

      expect(DIAS[real.getUTCDay()]).toBe(dia);
    },
  );
});

describe('relevancia: los casos pueden fallar de verdad', () => {
  const banco = bancos.find((b) => b.banco.juicio === 'relevancia')!.banco;

  it.each(banco.casos.map((c) => [c.por as string, c]))(
    '%s: el ganador está en el catálogo y NO es el primero',
    (_por, caso) => {
      const candidatos = (caso as { candidatos: string[] }).candidatos;
      const primero = (caso as { primero: string }).primero;

      expect(candidatos).toContain(primero);
      // Si fuera el primero, la reordenación estable lo dejaría ahí incluso sin
      // veredictos: el caso puntuaría bien con el proveedor apagado.
      expect(candidatos.indexOf(primero)).toBeGreaterThan(0);
    },
  );

  it('los candidatos llegan en el orden en que los devuelve el catálogo (alfabético)', () => {
    for (const caso of banco.casos) {
      const candidatos = (caso as unknown as { candidatos: string[] })
        .candidatos;
      const alfabetico = [...candidatos].sort((a, b) =>
        a.localeCompare(b, 'es'),
      );

      expect(candidatos).toEqual(alfabetico);
    }
  });
});

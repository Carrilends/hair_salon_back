import { ViewAbsencesTool } from './ver-ausencias.tool';
import { AssistantContext } from './assistant-tool';

/** Ausencias por WhatsApp (2026-11-11): la dueña pregunta qué ausencias hay. */
const duena: AssistantContext = {
  userId: null,
  isAdmin: true,
  now: new Date('2026-11-12T12:00:00Z'),
  canal: 'whatsapp',
  phoneE164: '573208977471',
};

function montar(
  filas: {
    id: string;
    workerId: string;
    workerName: string;
    startsAt: Date;
    endsAt: Date;
  }[],
) {
  let llamadas = 0;
  const sut = new ViewAbsencesTool({
    execute: async () => {
      llamadas++;
      return filas;
    },
  });
  return { sut, llamadas: () => llamadas };
}

describe('verAusencias', () => {
  it('solo la dueña por WhatsApp', async () => {
    const { sut, llamadas } = montar([]);

    expect(await sut.execute({}, { ...duena, isAdmin: false })).toEqual({
      ok: false,
      motivo: 'solo_duena',
    });
    expect(llamadas()).toBe(0);
  });

  it('devuelve las próximas en texto: estilista, día y franja', async () => {
    const { sut } = montar([
      {
        id: 'a-1',
        workerId: 'w-1',
        workerName: 'Lucía Ejemplo',
        startsAt: new Date('2026-11-12T13:00:00Z'),
        endsAt: new Date('2026-11-12T17:00:00Z'),
      },
      {
        id: 'a-2',
        workerId: 'w-2',
        workerName: 'Ana Prueba',
        // Sábado: 9:00 a. m. a 7:00 p. m., el día entero.
        startsAt: new Date('2026-11-14T14:00:00Z'),
        endsAt: new Date('2026-11-15T00:00:00Z'),
      },
    ]);

    const r = (await sut.execute({}, duena)) as {
      ok: boolean;
      ausencias: string[];
    };

    expect(r.ok).toBe(true);
    expect(r.ausencias).toHaveLength(2);
    expect(r.ausencias[0]).toMatch(
      /^Lucía Ejemplo: jueves, 12 de noviembre de 2026, de 8:00 a\. m\. a 12:00 p\. m\.$/,
    );
    expect(r.ausencias[1]).toMatch(
      /^Ana Prueba: sábado, 14 de noviembre de 2026, todo el día$/,
    );
    // Sin ids: el modelo no los necesita, y quitarla es solo del panel.
    expect(JSON.stringify(r)).not.toMatch(/a-1|w-1/);
  });

  it('sin ausencias lo dice', async () => {
    const { sut } = montar([]);

    expect(await sut.execute({}, duena)).toEqual({
      ok: true,
      ausencias: [],
      nota: 'No hay ausencias registradas de hoy en adelante.',
    });
  });
});

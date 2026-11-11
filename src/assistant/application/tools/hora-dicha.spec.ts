import { horasEscritas, PREGUNTA_HORA } from './hora-dicha';
import { ProposeBookingTool } from './proponer.tool';
import { AssistantContext } from './assistant-tool';
import { MensajeReciente } from '../screening/turn-screen';
import { PendingBooking } from '../../domain/pending-booking';

/**
 * Prueba con móvil del 2026-11-10: «quiero reservar el Taper Fade el viernes 10
 * a nombre de Luisa» terminó en una propuesta a las 8:00. En WhatsApp no se
 * guarda una propuesta a una hora que no coincide con ninguna de las que la
 * clienta escribió.
 */
const S1 = '11111111-1111-4111-8111-111111111111';
const NUMERO = '573001112233';
const DEF = {
  name: 'crearReserva',
  description: 'x',
  parameters: { type: 'object', properties: {} },
};

const deLaClienta = (...textos: string[]): MensajeReciente[] =>
  textos.map((texto) => ({ rol: 'clienta' as const, texto }));

function contexto(recientes: MensajeReciente[]): AssistantContext {
  return {
    userId: null,
    isAdmin: false,
    now: new Date('2026-11-10T23:00:00Z'),
    canal: 'whatsapp',
    phoneE164: NUMERO,
    canalConversacional: true,
    recientes,
  };
}

function montar() {
  const guardadas: Omit<PendingBooking, 'id'>[] = [];
  const reemplazos: string[] = [];
  const tool = new ProposeBookingTool('crearReserva', DEF, {
    pendientes: {
      save: async (b) => {
        guardadas.push(b);
        return { ...b, id: 'p-1' };
      },
      supersedeActiveFor: async (phone) => {
        reemplazos.push(phone);
      },
    },
    catalog: { findNamesByIds: async () => new Map([[S1, 'Taper fade']]) },
  });
  return { tool, guardadas, reemplazos };
}

/** Viernes 13 de noviembre de 2026, a la hora del salón indicada. */
const aLas = (hhmm: string) => ({
  fechaHoraIso: `2026-11-13T${hhmm}:00`,
  serviciosIds: [S1],
  nombre: 'Luisa',
});

const BLOQUEO = {
  ok: false,
  motivo: 'hora_no_dicha',
  pregunta: PREGUNTA_HORA,
};

describe('ProposeBookingTool, hora dicha: el caso de la prueba con móvil', () => {
  const LUIS = deLaClienta(
    'Ah, por cierto quiero reservar el Taper Fade el viernes 10 a nombre de Luisa',
  );

  it('no propone las 8:00 cuando ella escribió «viernes 10», y no guarda nada', async () => {
    const { tool, guardadas, reemplazos } = montar();

    const r = await tool.execute(aLas('08:00'), contexto(LUIS));

    expect(r).toEqual(BLOQUEO);
    expect(guardadas).toEqual([]);
    // Tampoco anula la propuesta viva que hubiera: no se tocó nada.
    expect(reemplazos).toEqual([]);
  });

  it('a las 10:00 sí la propone', async () => {
    const { tool, guardadas } = montar();

    const r = await tool.execute(aLas('10:00'), contexto(LUIS));

    expect(r).toMatchObject({ ok: true, estado: 'pendiente_de_confirmar' });
    expect(guardadas).toHaveLength(1);
  });

  it('la pregunta es la fija, con el formato de 12 horas', () => {
    expect(PREGUNTA_HORA).toBe(
      '¿A qué hora la quieres? Escríbela así: 10:00 a. m.',
    );
  });
});

describe('ProposeBookingTool, hora dicha: qué cuenta como hora', () => {
  it.each([
    ['a las 3 de la tarde', '15:00'],
    ['a las 3', '15:00'],
    ['a las 15', '15:00'],
    ['a las 15:00', '15:00'],
    ['tipo 10 am', '10:00'],
    ['a las 4 p. m.', '16:00'],
    ['a las 10:30', '10:30'],
    ['a las 10 y media', '10:30'],
    ['a la 1', '13:00'],
    ['a las tres', '15:00'],
    ['al mediodía', '12:00'],
    ['mañana 9', '09:00'],
  ])('«%s» acepta las %s', async (texto, hhmm) => {
    const { tool, guardadas } = montar();
    await tool.execute(aLas(hhmm), contexto(deLaClienta(texto)));
    expect(guardadas).toHaveLength(1);
  });

  it.each([
    ['a las 3 de la tarde', '10:00'],
    ['a las 3', '10:00'],
    ['a las 4 p. m.', '16:30'],
    ['a las 10:30', '10:00'],
    ['a las 10 am', '22:00'],
  ])('«%s» no acepta las %s', async (texto, hhmm) => {
    const { tool, guardadas } = montar();
    expect(
      await tool.execute(aLas(hhmm), contexto(deLaClienta(texto))),
    ).toEqual(BLOQUEO);
    expect(guardadas).toEqual([]);
  });

  it('sin ninguna hora escrita no bloquea (puede estar aceptando una que le ofrecieron)', async () => {
    const { tool, guardadas } = montar();
    await tool.execute(
      aLas('08:00'),
      contexto(deLaClienta('quiero el taper fade el viernes', 'sí, esa')),
    );
    expect(guardadas).toHaveLength(1);
  });

  it.each([
    'el viernes 13 de noviembre',
    'para el 13 de nov',
    'el 13/11',
    'el que cuesta $25.000',
    'el de 25 mil',
    'mi número es 3001234567',
    'son 2 servicios',
  ])('«%s» no es una hora: no bloquea', async (texto) => {
    const { tool, guardadas } = montar();
    await tool.execute(aLas('08:00'), contexto(deLaClienta(texto)));
    expect(guardadas).toHaveLength(1);
  });

  it('solo cuentan los mensajes de ella, no las horas que ofreció el asistente', async () => {
    const { tool, guardadas } = montar();
    await tool.execute(aLas('08:00'), {
      ...contexto([
        { rol: 'clienta', texto: 'quiero el taper fade el viernes' },
        {
          rol: 'asistente',
          texto: 'Tengo a las 8:00 a. m. o a las 11:00 a. m.',
        },
        { rol: 'clienta', texto: 'la primera' },
      ]),
    });
    expect(guardadas).toHaveLength(1);
  });

  it('basta con que coincida con una de las que escribió', async () => {
    const { tool, guardadas } = montar();
    await tool.execute(
      aLas('11:00'),
      contexto(deLaClienta('el viernes a las 10', 'mejor a las 11')),
    );
    expect(guardadas).toHaveLength(1);
  });

  it('fuera de WhatsApp o sin fecha legible deja decidir a la herramienta', async () => {
    const { tool } = montar();
    const web: AssistantContext = {
      ...contexto(deLaClienta('a las 10')),
      canal: 'web',
    };
    expect(await tool.execute(aLas('08:00'), web)).toMatchObject({
      ok: false,
      motivo: 'solo_whatsapp',
    });
    expect(
      await tool.execute(
        { ...aLas('08:00'), fechaHoraIso: 'el viernes' },
        contexto(deLaClienta('a las 10')),
      ),
    ).toMatchObject({ ok: false, motivo: 'argumentos_invalidos' });
  });
});

describe('horasEscritas', () => {
  it('«viernes 10» cuenta como hora posible (ambigua)', () => {
    expect(horasEscritas('el viernes 10 a nombre de Luisa')).toEqual([
      { hora: 10, minuto: null, franja: null },
    ]);
  });

  it('el día del mes no cuenta', () => {
    expect(horasEscritas('el viernes 13 de noviembre')).toEqual([]);
  });
});

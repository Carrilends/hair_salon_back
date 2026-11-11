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
  instruccion:
    'No vuelvas a llamar a esta herramienta en este turno: pregúntale a qué hora la quiere y espera su respuesta.',
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
    ['a las 3 y 30', '15:30'],
    ['tipo 2 y 15', '14:15'],
    ['a las 10 y media', '10:30'],
    ['a las 3 y cuarto', '15:15'],
    ['las once', '11:00'],
    ['la de las 3', '15:00'],
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
    ['las once', '10:00'],
    ['tipo 2 y 15', '14:00'],
    ['a las 3 y cuarto', '15:00'],
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
    'el viernes 2 servicios',
    'para mañana 2 cortes',
    'para 2 personas',
    'quiero las dos cosas',
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

  it('sin horas de ella, aceptar una de las que ofreció el asistente no se bloquea', async () => {
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

/**
 * Revisión del 2026-11-10: la regla bloqueaba de más. Aceptar una hora que
 * ofreció el asistente, contestar a la pregunta con un número suelto o elegir
 * «la 2» de una lista no son horas inventadas.
 */
describe('ProposeBookingTool, hora dicha: lo que no debe bloquear', () => {
  const asistente = (texto: string): MensajeReciente => ({
    rol: 'asistente',
    texto,
  });
  const clienta = (texto: string): MensajeReciente => ({
    rol: 'clienta',
    texto,
  });
  const proponer = async (hhmm: string, recientes: MensajeReciente[]) => {
    const { tool, guardadas } = montar();
    const r = await tool.execute(aLas(hhmm), contexto(recientes));
    return { r, guardadas };
  };

  it('«el viernes a las 10» → le ofrecen las 11:00 a. m. → «sí»: pasa', async () => {
    const { guardadas } = await proponer('11:00', [
      clienta('el viernes a las 10'),
      asistente('A las 10 no hay. ¿Te sirve a las 11:00 a. m.?'),
      clienta('sí'),
    ]);
    expect(guardadas).toHaveLength(1);
  });

  it('«cita el sábado 14» → le ofrecen las 9:00 → «la primera»: pasa', async () => {
    const { guardadas } = await proponer('09:00', [
      clienta('cita el sábado 14'),
      asistente('El sábado 14 tengo a las 9:00 a. m. o a las 2:00 p. m.'),
      clienta('la primera'),
    ]);
    expect(guardadas).toHaveLength(1);
  });

  it('«después de las 3» → le ofrecen las 4:00 p. m. → «listo»: pasa', async () => {
    const { guardadas } = await proponer('16:00', [
      clienta('el viernes después de las 3'),
      asistente('Tengo a las 4:00 p. m.'),
      clienta('listo'),
    ]);
    expect(guardadas).toHaveLength(1);
  });

  it('el caso de Luis sigue bloqueando las 8:00 aunque el asistente dijera «abrimos 8:00 a. m.»', async () => {
    const { r, guardadas } = await proponer('08:00', [
      clienta('¿a qué hora abren?'),
      asistente('El viernes abrimos 8:00 a. m.'),
      clienta(
        'Ah, por cierto quiero reservar el Taper Fade el viernes 10 a nombre de Luisa',
      ),
    ]);
    expect(r).toEqual(BLOQUEO);
    expect(guardadas).toEqual([]);
  });

  it('solo cuenta el mensaje del asistente justo antes de su último mensaje', async () => {
    const { r } = await proponer('08:00', [
      clienta('el viernes a las 10'),
      asistente('Tengo a las 8:00 a. m.'),
      clienta('no, mejor más tarde'),
      asistente('¿Qué servicio quieres?'),
      clienta('el taper fade'),
    ]);
    expect(r).toEqual(BLOQUEO);
  });

  it('el ejemplo de la pregunta fija («10:00 a. m.») no cuenta como hora ofrecida', async () => {
    const { r } = await proponer('10:00', [
      clienta('a las 11'),
      asistente(PREGUNTA_HORA),
      clienta('ok'),
    ]);
    expect(r).toEqual(BLOQUEO);
  });

  it('«a las 10» → bloqueado a las 11:00 → «11»: pasa', async () => {
    const antes = [clienta('a las 10')];
    expect((await proponer('11:00', antes)).r).toEqual(BLOQUEO);
    const { guardadas } = await proponer('11:00', [
      ...antes,
      asistente(PREGUNTA_HORA),
      clienta('11'),
    ]);
    expect(guardadas).toHaveLength(1);
  });

  it('«la 2» de una lista no es las 2 de la tarde', async () => {
    const { guardadas } = await proponer('10:00', [
      clienta('el viernes'),
      asistente('1. Corte 2. Taper fade 3. Barba'),
      clienta('la 2'),
    ]);
    expect(guardadas).toHaveLength(1);
  });

  it('«la de las 3» sigue siendo una hora', async () => {
    const { r } = await proponer('10:00', [clienta('la de las 3')]);
    expect(r).toEqual(BLOQUEO);
  });
});

describe('horasEscritas: detrás de un día solo cuenta de 1 a 12', () => {
  it.each(['el viernes 13', 'cita el sábado 14', 'el domingo 0'])(
    '«%s» no tiene hora',
    (texto) => {
      expect(horasEscritas(texto)).toEqual([]);
    },
  );

  it('un mensaje que es solo un número es una hora', () => {
    expect(horasEscritas('11')).toEqual([
      { hora: 11, minuto: null, franja: null },
    ]);
    expect(horasEscritas(' 3. ')).toEqual([
      { hora: 3, minuto: null, franja: null },
    ]);
  });
});

import { CancelReservationTool } from './cancel-reservation.tool';
import { RescheduleReservationTool } from './reschedule-reservation.tool';
import { MyReservationsTool } from './my-reservations.tool';
import { AssistantContext } from './assistant-tool';
import { Reservation } from 'src/reservations/domain/reservation';
import { ReservationStatus } from 'src/reservations/domain/reservation-status';
import { ReservationActor } from 'src/reservations/domain/reservation-actor';
import { assertCanActOn } from 'src/reservations/domain/reservation-authorization';

/**
 * TC-RF54-02 / M-197: una cancelación o un cambio nunca puede caer sobre una
 * cita distinta de la que la clienta nombró. La herramienta compara el día y la
 * hora que la clienta dijo con los de la cita real, antes de escribir nada.
 */
const ctx: AssistantContext = {
  userId: 'u1',
  isAdmin: false,
  now: new Date('2026-10-20T12:00:00Z'),
};
const admin: AssistantContext = { ...ctx, userId: 'a1', isAdmin: true };
// 14:00Z = 09:00 en Bogotá
const citaDe = (id: string, userId: string) =>
  Reservation.fromPersistence({
    id,
    userId,
    contact: null,
    scheduledAt: new Date('2026-11-08T14:00:00Z'),
    endedAt: new Date('2026-11-08T14:30:00Z'),
    workerId: 'w-1',
    status: ReservationStatus.Pendiente,
    lines: [{ serviceId: 's-1', name: 'Corte', price: 1, durationMinutes: 30 }],
  });
const real = citaDe('r1', 'u1');
// La de otra cuenta, el mismo día y a la misma hora.
const ajena = citaDe('r-ajena', 'u2');
const leer = async (id: string) =>
  id === 'r1' ? real : id === 'r-ajena' ? ajena : null;
const LA_CITA = { fechaDeLaCita: '2026-11-08', horaDeLaCita: '09:00' };
const OTRA_HORA = { fechaDeLaCita: '2026-11-08', horaDeLaCita: '11:00' };
const OTRO_DIA = { fechaDeLaCita: '2026-11-09', horaDeLaCita: '09:00' };

/**
 * Los casos de uso de verdad deciden la propiedad con `assertCanActOn`; los
 * dobles hacen lo mismo para que la prueba de una reserva ajena sea honesta.
 */
async function comoElCasoDeUso(id: string, actor: ReservationActor) {
  const r = await leer(id);
  if (r) assertCanActOn(r, actor);
}

describe('cancelarReserva · cita pedida', () => {
  const montar = () => {
    const llamadas: string[] = [];
    const cancel = {
      execute: async (id: string, actor: ReservationActor) => {
        await comoElCasoDeUso(id, actor);
        llamadas.push(id);
        return { status: 'cancelada' };
      },
    };
    return { llamadas, tool: new CancelReservationTool(cancel as never, leer) };
  };

  it('una reserva ajena responde lo mismo con su día y hora que sin ellos (no es un oráculo)', async () => {
    const { llamadas, tool } = montar();
    const respuestas = [];
    for (const pedida of [LA_CITA, OTRA_HORA, OTRO_DIA]) {
      respuestas.push(
        await tool.execute({ reservaId: 'r-ajena', ...pedida }, ctx),
      );
    }
    for (const r of respuestas) {
      expect(r).toEqual({ ok: false, motivo: 'no_es_tu_reserva' });
    }
    expect(llamadas).toEqual([]);
  });

  it('la administración sí compara: una hora distinta no cancela la cita de otra', async () => {
    const { llamadas, tool } = montar();
    expect(
      await tool.execute({ reservaId: 'r-ajena', ...OTRA_HORA }, admin),
    ).toMatchObject({ ok: false, motivo: 'no_coincide_con_lo_pedido' });
    expect(llamadas).toEqual([]);
    expect(
      await tool.execute({ reservaId: 'r-ajena', ...LA_CITA }, admin),
    ).toEqual({ ok: true, estado: 'cancelada' });
  });

  it.each(['9:00', '9'])(
    'acepta la hora sin cero delante (%s) y la entiende como 09:00',
    async (hora) => {
      const { llamadas, tool } = montar();
      const res = await tool.execute(
        { reservaId: 'r1', fechaDeLaCita: '2026-11-08', horaDeLaCita: hora },
        ctx,
      );
      expect(res).toEqual({ ok: true, estado: 'cancelada' });
      expect(llamadas).toEqual(['r1']);
    },
  );

  it.each(['9h', '25:00', '09:60', '9:5', 'nueve', '009:00'])(
    'una hora que no se entiende (%s) es un argumento inválido',
    async (hora) => {
      const { llamadas, tool } = montar();
      expect(
        await tool.execute(
          { reservaId: 'r1', fechaDeLaCita: '2026-11-08', horaDeLaCita: hora },
          ctx,
        ),
      ).toEqual({ ok: false, motivo: 'argumentos_invalidos' });
      expect(llamadas).toEqual([]);
    },
  );

  it('rechaza si la hora pedida no es la de la cita y no cancela nada', async () => {
    const { llamadas, tool } = montar();
    const res = await tool.execute(
      { reservaId: 'r1', fechaDeLaCita: '2026-11-08', horaDeLaCita: '11:00' },
      ctx,
    );
    expect(res).toMatchObject({
      ok: false,
      motivo: 'no_coincide_con_lo_pedido',
    });
    expect(llamadas).toEqual([]);
  });

  it('rechaza si el día no coincide', async () => {
    const { llamadas, tool } = montar();
    const res = await tool.execute(
      { reservaId: 'r1', fechaDeLaCita: '2026-11-09', horaDeLaCita: '09:00' },
      ctx,
    );
    expect(res).toMatchObject({
      ok: false,
      motivo: 'no_coincide_con_lo_pedido',
    });
    expect(llamadas).toEqual([]);
  });

  it('cancela cuando día y hora coinciden', async () => {
    const { llamadas, tool } = montar();
    const res = await tool.execute(
      { reservaId: 'r1', fechaDeLaCita: '2026-11-08', horaDeLaCita: '09:00' },
      ctx,
    );
    expect(res).toEqual({ ok: true, estado: 'cancelada' });
    expect(llamadas).toEqual(['r1']);
  });

  it('exige día y hora, y un id desconocido sigue su camino al caso de uso', async () => {
    const { llamadas, tool } = montar();
    expect(await tool.execute({ reservaId: 'r1' }, ctx)).toEqual({
      ok: false,
      motivo: 'argumentos_invalidos',
    });
    await tool.execute(
      { reservaId: 'r-x', fechaDeLaCita: '2026-11-08', horaDeLaCita: '09:00' },
      ctx,
    );
    expect(llamadas).toEqual(['r-x']);
  });

  it('el esquema pide día y hora', () => {
    const { tool } = montar();
    expect(tool.definition.parameters).toMatchObject({
      required: ['reservaId', 'fechaDeLaCita', 'horaDeLaCita'],
    });
  });
});

describe('reprogramarReserva · cita pedida', () => {
  const montar = () => {
    const llamadas: string[] = [];
    const uc = {
      execute: async (id: string, _f: string, actor: ReservationActor) => {
        await comoElCasoDeUso(id, actor);
        llamadas.push(id);
        return { reservation: { status: 'pendiente' }, workerChanged: false };
      },
    };
    return {
      llamadas,
      tool: new RescheduleReservationTool(uc as never, undefined, leer),
    };
  };
  const base = { reservaId: 'r1', nuevaFecha: '2026-11-10T10:00:00' };

  it('rechaza si no es la cita que se nombró y no mueve nada', async () => {
    const { llamadas, tool } = montar();
    const res = await tool.execute(
      { ...base, fechaDeLaCita: '2026-11-08', horaDeLaCita: '11:00' },
      ctx,
    );
    expect(res).toMatchObject({
      ok: false,
      motivo: 'no_coincide_con_lo_pedido',
    });
    expect(llamadas).toEqual([]);
  });

  it('una reserva ajena responde lo mismo con su día y hora que sin ellos (no es un oráculo)', async () => {
    const { llamadas, tool } = montar();
    for (const pedida of [LA_CITA, OTRA_HORA, OTRO_DIA]) {
      expect(
        await tool.execute({ ...base, reservaId: 'r-ajena', ...pedida }, ctx),
      ).toEqual({ ok: false, motivo: 'no_es_tu_reserva' });
    }
    expect(llamadas).toEqual([]);
  });

  it('mueve cuando coincide', async () => {
    const { llamadas, tool } = montar();
    const res = await tool.execute(
      { ...base, fechaDeLaCita: '2026-11-08', horaDeLaCita: '09:00' },
      ctx,
    );
    expect(res).toMatchObject({ ok: true });
    expect(llamadas).toEqual(['r1']);
  });

  it('el esquema pide día y hora de la cita', () => {
    const { tool } = montar();
    expect(tool.definition.parameters).toMatchObject({
      required: ['reservaId', 'nuevaFecha', 'fechaDeLaCita', 'horaDeLaCita'],
    });
  });
});

describe('misReservas · por día', () => {
  const dia = (i: number) => ({
    id: `d${i}`,
    // 13 citas el mismo día, 12:00Z..; desde las 08:00 Bogotá
    scheduledAt: new Date(Date.UTC(2026, 10, 8, 13 + (i % 8), i < 8 ? 0 : 30)),
    status: 'pendiente',
    totalDurationMinutes: 30,
    services: [{ name: 'Corte' }],
    workerPinned: false,
  });
  const otraFecha = {
    ...dia(0),
    id: 'otro-dia',
    scheduledAt: new Date('2026-11-09T14:00:00Z'),
  };
  const todas = [otraFecha, ...Array.from({ length: 13 }, (_, i) => dia(i))];
  const tool = () =>
    new MyReservationsTool({ execute: async () => todas } as never);

  it('devuelve todas las de ese día, sin tope de diez, y solo ese día', async () => {
    const res = (await tool().execute({ fecha: '2026-11-08' }, ctx)) as Array<{
      id: string;
    }>;
    expect(res).toHaveLength(13);
    expect(res.some((r) => r.id === 'otro-dia')).toBe(false);
  });

  it('presenta como mucho diez (RF54 c1) y dice cuántas más hay ese día, sin prometer lo que no existe', async () => {
    const t = tool();
    const p = await t.presentar(await t.execute({ fecha: '2026-11-08' }, ctx));
    if (p?.tipo !== 'texto') throw new Error('no es texto');
    expect(p.lineas.filter((l) => /^\d+\. /.test(l))).toHaveLength(10);
    expect(p.lineas).toHaveLength(11);
    expect(p.lineas[10]).toBe(
      'Ese día tienes 3 reservas más; puedes verlas todas en «Mis reservas» del portal.',
    );
  });

  it('por WhatsApp, el aviso del día no manda al portal ni vuelve a pedir un día', async () => {
    const t = new MyReservationsTool(
      { execute: async () => [] } as never,
      { execute: async () => todas } as never,
    );
    const porWhatsApp: AssistantContext = {
      userId: null,
      isAdmin: false,
      now: ctx.now,
      canal: 'whatsapp',
      phoneE164: '573000000000',
    };
    const p = await t.presentar(
      await t.execute({ fecha: '2026-11-08' }, porWhatsApp),
    );
    if (p?.tipo !== 'texto') throw new Error('no es texto');
    const ultima = p.lineas[p.lineas.length - 1];
    expect(ultima).toBe(
      'Ese día tienes 3 reservas más; pregúntame por la que buscas.',
    );
    expect(ultima).not.toMatch(/portal|pídeme un día/);
  });

  it('con diez o menos ese día, las presenta todas sin línea de «más»', async () => {
    const pocas = Array.from({ length: 4 }, (_, i) => dia(i));
    const t = new MyReservationsTool({ execute: async () => pocas } as never);
    const p = await t.presentar(await t.execute({ fecha: '2026-11-08' }, ctx));
    if (p?.tipo !== 'texto') throw new Error('no es texto');
    expect(p.lineas).toHaveLength(4);
    expect(p.lineas.join('\n')).not.toMatch(/más/);
  });

  it('sin fecha sigue igual: las diez más próximas', async () => {
    const res = (await tool().execute({}, ctx)) as unknown[];
    expect(res).toHaveLength(10);
  });

  it('una fecha mal formada es un argumento inválido', async () => {
    expect(await tool().execute({ fecha: 'mañana' }, ctx)).toEqual({
      ok: false,
      motivo: 'argumentos_invalidos',
    });
  });

  it('el esquema ofrece fecha opcional', () => {
    expect(tool().definition.parameters).toMatchObject({
      properties: { fecha: { type: 'string' } },
      required: [],
    });
  });
});

/**
 * T2 (revisión final): el día del salón no es el día UTC. De 19:00 a 20:00 en
 * Bogotá ya es el día siguiente en UTC (00:00–01:00Z), y una cita de esa franja
 * tiene que contar en el día del salón tanto para filtrar como para la guardia.
 */
describe('cerca de la medianoche UTC', () => {
  // 2026-11-09T00:30Z = domingo 8 de noviembre, 19:30 en Bogotá.
  const tarde = Reservation.fromPersistence({
    id: 'r-tarde',
    userId: 'u1',
    contact: null,
    scheduledAt: new Date('2026-11-09T00:30:00Z'),
    endedAt: new Date('2026-11-09T01:00:00Z'),
    workerId: 'w-1',
    status: ReservationStatus.Pendiente,
    lines: [{ serviceId: 's-1', name: 'Corte', price: 1, durationMinutes: 30 }],
  });
  const vistaTarde = {
    id: 'r-tarde',
    scheduledAt: tarde.scheduledAt,
    endedAt: tarde.endedAt,
    status: 'pendiente',
    totalDurationMinutes: 30,
    services: [{ name: 'Corte' }],
    workerPinned: false,
  };
  const mis = () =>
    new MyReservationsTool({ execute: async () => [vistaTarde] } as never);

  it('misReservas la cuenta en el día del salón, no en el día UTC', async () => {
    const delDia = (await mis().execute(
      { fecha: '2026-11-08' },
      ctx,
    )) as Array<{
      id: string;
      hora: string;
    }>;
    expect(delDia.map((r) => r.id)).toEqual(['r-tarde']);
    expect(delDia[0].hora).toBe('19:30');
    expect(await mis().execute({ fecha: '2026-11-09' }, ctx)).toEqual([]);
  });

  it('la guardia la reconoce por su día y su hora del salón', async () => {
    const escritas: string[] = [];
    const tool = new CancelReservationTool(
      {
        execute: async (id: string) => {
          escritas.push(id);
          return { status: 'cancelada', scheduledAt: tarde.scheduledAt };
        },
      },
      async (id) => (id === 'r-tarde' ? tarde : null),
    );

    expect(
      await tool.execute(
        {
          reservaId: 'r-tarde',
          fechaDeLaCita: '2026-11-09',
          horaDeLaCita: '19:30',
        },
        ctx,
      ),
    ).toMatchObject({ ok: false, motivo: 'no_coincide_con_lo_pedido' });
    expect(escritas).toEqual([]);

    expect(
      await tool.execute(
        {
          reservaId: 'r-tarde',
          fechaDeLaCita: '2026-11-08',
          horaDeLaCita: '19:30',
        },
        ctx,
      ),
    ).toMatchObject({ ok: true });
    expect(escritas).toEqual(['r-tarde']);
  });
});

/**
 * Revisión final, punto 1: un id escrito por el modelo que no tiene forma de
 * UUID («3», el número de la línea de la lista) hacía fallar la lectura en
 * Postgres fuera de todo `try`, y el turno entero se perdía (500 en la web).
 */
describe('la guardia no tumba el turno si la lectura falla', () => {
  const UUID_VALIDO = '0b8f6a8e-2c1d-4c3b-9a4e-5f6a7b8c9d0e';
  const leerQueFalla = async () => {
    throw new Error('invalid input syntax for type uuid: "3"');
  };

  it.each(['3', 'r1'])(
    'cancelar con un id sin forma de UUID (%s) responde reserva_no_encontrada y no escribe',
    async (id) => {
      const escritas: string[] = [];
      const tool = new CancelReservationTool(
        {
          execute: async (rid: string) => {
            escritas.push(rid);
            return { status: 'cancelada' };
          },
        },
        leerQueFalla,
      );
      await expect(
        tool.execute({ reservaId: id, ...LA_CITA }, ctx),
      ).resolves.toEqual({ ok: false, motivo: 'reserva_no_encontrada' });
      expect(escritas).toEqual([]);
    },
  );

  it('mover con un id sin forma de UUID responde reserva_no_encontrada y no escribe', async () => {
    const escritas: string[] = [];
    const tool = new RescheduleReservationTool(
      {
        execute: async (rid: string) => {
          escritas.push(rid);
          return { reservation: { status: 'pendiente' }, workerChanged: false };
        },
      },
      undefined,
      leerQueFalla,
    );
    await expect(
      tool.execute(
        { reservaId: '3', nuevaFecha: '2026-11-10T10:00:00', ...LA_CITA },
        ctx,
      ),
    ).resolves.toEqual({ ok: false, motivo: 'reserva_no_encontrada' });
    expect(escritas).toEqual([]);
  });

  it('con un UUID válido y la base caída, deja responder al caso de uso', async () => {
    const escritas: string[] = [];
    const tool = new CancelReservationTool(
      {
        execute: async (rid: string) => {
          escritas.push(rid);
          throw new Error('conexión perdida');
        },
      },
      leerQueFalla,
    );
    await expect(
      tool.execute({ reservaId: UUID_VALIDO, ...LA_CITA }, ctx),
    ).resolves.toEqual({ ok: false, motivo: 'error_desconocido' });
    expect(escritas).toEqual([UUID_VALIDO]);
  });
});

/**
 * Revisión final, punto 3 (M-203): la guardia compara con lo que escribe el
 * modelo, y tras un rechazo nada le impedía volver a llamar en el mismo turno
 * con la hora real de la cita, sin que la clienta lo hubiera aceptado.
 */
describe('tras un rechazo, la cita no se toca en el mismo turno', () => {
  const enElTurno = (): AssistantContext => ({
    ...ctx,
    citasQueNoCoincidieron: new Set<string>(),
  });
  const cancelar = () => {
    const escritas: string[] = [];
    const tool = new CancelReservationTool(
      {
        execute: async (id: string) => {
          escritas.push(id);
          return { status: 'cancelada', scheduledAt: real.scheduledAt };
        },
      },
      leer,
    );
    return { tool, escritas };
  };
  const mover = () => {
    const escritas: string[] = [];
    const tool = new RescheduleReservationTool(
      {
        execute: async (id: string) => {
          escritas.push(id);
          return { reservation: { status: 'pendiente' }, workerChanged: false };
        },
      },
      undefined,
      leer,
    );
    return { tool, escritas };
  };

  it('el rechazo dice cuál es la cita de ese id y lleva a preguntarle a la clienta', async () => {
    const { tool } = cancelar();
    const res = await tool.execute({ reservaId: 'r1', ...OTRA_HORA }, ctx);
    expect(res).toMatchObject({
      ok: false,
      motivo: 'no_coincide_con_lo_pedido',
      laCitaConEseId: {
        fecha: 'domingo, 8 de noviembre de 2026',
        hora: '09:00',
      },
    });
    expect((res as { queHacer: string }).queHacer).toMatch(/preg[uú]ntale/i);
  });

  it('al mover, el rechazo pide repetir en la pregunta la hora nueva', async () => {
    const { tool } = mover();
    const res = await tool.execute(
      { reservaId: 'r1', nuevaFecha: '2026-11-08T15:00:00', ...OTRA_HORA },
      ctx,
    );
    expect(res).toMatchObject({ motivo: 'no_coincide_con_lo_pedido' });
    expect((res as { queHacer: string }).queHacer).toMatch(/hora nueva/i);
  });

  it('una segunda llamada con la hora real de esa cita no cancela: hay que confirmarlo con la clienta', async () => {
    const { tool, escritas } = cancelar();
    const turno = enElTurno();
    await tool.execute({ reservaId: 'r1', ...OTRA_HORA }, turno);
    const otra = await tool.execute({ reservaId: 'r1', ...LA_CITA }, turno);
    expect(otra).toMatchObject({
      ok: false,
      motivo: 'confirmar_con_la_clienta',
    });
    expect(escritas).toEqual([]);
  });

  it('vale también entre cancelar y mover: mismo turno, misma cita', async () => {
    const { tool: c } = cancelar();
    const { tool: m, escritas } = mover();
    const turno = enElTurno();
    await c.execute({ reservaId: 'r1', ...OTRA_HORA }, turno);
    expect(
      await m.execute(
        { reservaId: 'r1', nuevaFecha: '2026-11-08T15:00:00', ...LA_CITA },
        turno,
      ),
    ).toMatchObject({ ok: false, motivo: 'confirmar_con_la_clienta' });
    expect(escritas).toEqual([]);
  });

  it('una reserva ajena no entra en la lista del turno (no hay comparación)', async () => {
    const { tool } = cancelar();
    const turno = enElTurno();
    await tool.execute({ reservaId: 'r-ajena', ...OTRA_HORA }, turno);
    expect(turno.citasQueNoCoincidieron?.size).toBe(0);
  });

  it('en el turno siguiente (otro contexto), con la hora real, sí se cancela', async () => {
    const { tool, escritas } = cancelar();
    await tool.execute({ reservaId: 'r1', ...OTRA_HORA }, enElTurno());
    expect(
      await tool.execute({ reservaId: 'r1', ...LA_CITA }, enElTurno()),
    ).toMatchObject({ ok: true });
    expect(escritas).toEqual(['r1']);
  });
});

describe('cancelarReserva · confirmación escrita por el sistema', () => {
  it('presenta el día y la hora de la cita cancelada', async () => {
    const tool = new CancelReservationTool(
      {
        execute: async () => ({
          status: 'cancelada',
          scheduledAt: real.scheduledAt,
        }),
      },
      leer,
    );
    const p = await tool.presentar(
      await tool.execute({ reservaId: 'r1', ...LA_CITA }, ctx),
    );
    if (p?.tipo !== 'texto') throw new Error('no es texto');
    expect(p.lineas).toEqual([
      'Cancelé tu cita del domingo, 8 de noviembre de 2026 a las 09:00.',
    ]);
    expect(p.clase).toBe('escritura');
  });

  it('un rechazo o un error no se presentan', async () => {
    const tool = new CancelReservationTool(
      { execute: async () => ({ status: 'cancelada' }) },
      leer,
    );
    expect(
      await tool.presentar(
        await tool.execute({ reservaId: 'r1', ...OTRA_HORA }, ctx),
      ),
    ).toBeNull();
    expect(
      await tool.presentar({ ok: false, motivo: 'fuera_de_plazo' }),
    ).toBeNull();
  });
});

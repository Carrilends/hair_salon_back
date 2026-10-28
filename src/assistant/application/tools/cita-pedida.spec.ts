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
    ).toEqual({ ok: false, motivo: 'no_coincide_con_lo_pedido' });
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
    expect(res).toEqual({ ok: false, motivo: 'no_coincide_con_lo_pedido' });
    expect(llamadas).toEqual([]);
  });

  it('rechaza si el día no coincide', async () => {
    const { llamadas, tool } = montar();
    const res = await tool.execute(
      { reservaId: 'r1', fechaDeLaCita: '2026-11-09', horaDeLaCita: '09:00' },
      ctx,
    );
    expect(res).toEqual({ ok: false, motivo: 'no_coincide_con_lo_pedido' });
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
    expect(res).toEqual({ ok: false, motivo: 'no_coincide_con_lo_pedido' });
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

  it('las presenta todas, sin línea de «hay más»', async () => {
    const t = tool();
    const p = await t.presentar(await t.execute({ fecha: '2026-11-08' }, ctx));
    if (p?.tipo !== 'texto') throw new Error('no es texto');
    expect(p.lineas).toHaveLength(13);
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

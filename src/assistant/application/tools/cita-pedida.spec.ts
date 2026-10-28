import { CancelReservationTool } from './cancel-reservation.tool';
import { RescheduleReservationTool } from './reschedule-reservation.tool';
import { MyReservationsTool } from './my-reservations.tool';
import { AssistantContext } from './assistant-tool';

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
// 14:00Z = 09:00 en Bogotá
const real = { scheduledAt: new Date('2026-11-08T14:00:00Z') };
const leer = async (id: string) => (id === 'r1' ? real : null);

describe('cancelarReserva · cita pedida', () => {
  const montar = () => {
    const llamadas: string[] = [];
    const cancel = {
      execute: async (id: string) => {
        llamadas.push(id);
        return { status: 'cancelada' };
      },
    };
    return { llamadas, tool: new CancelReservationTool(cancel as never, leer) };
  };

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
      execute: async (id: string) => {
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

import { ViewAgendaTool } from './view-agenda.tool';
import { ConfirmReservationTool } from './confirm-reservation.tool';
import { AssistantContext } from './assistant-tool';
import {
  InvalidStatusTransitionError,
  ReservationNotFoundError,
} from 'src/reservations/domain/errors';

/**
 * Plan 06, F3b: las dos herramientas nuevas de la dueña. Nunca se le ofrecen a
 * otro rol, y aun así cada una vuelve a exigir `isAdmin`: dos barreras.
 */
const ahora = new Date('2026-10-14T15:00:00Z');
const duena: AssistantContext = {
  userId: null,
  isAdmin: true,
  now: ahora,
  canal: 'whatsapp',
  phoneE164: '573208977471',
};
const clienta: AssistantContext = {
  ...duena,
  isAdmin: false,
  phoneE164: '573001112233',
};
const RID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';

function vista(over: Record<string, unknown>) {
  return {
    id: RID,
    // 15:00Z = 10:00 en Bogotá
    scheduledAt: new Date('2026-10-14T15:00:00Z'),
    endedAt: new Date('2026-10-14T15:30:00Z'),
    workerId: 'w-1',
    workerPinned: false,
    totalDurationMinutes: 30,
    status: 'pendiente',
    userId: null,
    contact: { name: 'Ana', phone: '3001112233' },
    worker: { id: 'w-1', name: 'Monica', isDefault: false },
    services: [
      { serviceId: 's', name: 'Corte', price: 1, durationMinutes: 30 },
    ],
    ...over,
  };
}

describe('verAgenda', () => {
  const agenda = [
    vista({}),
    vista({
      id: 'r-2',
      scheduledAt: new Date('2026-10-15T20:00:00Z'),
      contact: null,
      userId: 'u-1',
      status: 'confirmada',
    }),
  ];
  const tool = new ViewAgendaTool({ execute: async () => agenda as never });

  it('lista las citas activas, sin teléfonos de las clientas', async () => {
    const r = (await tool.execute({}, duena)) as {
      ok: true;
      citas: Record<string, unknown>[];
    };

    expect(r.ok).toBe(true);
    expect(r.citas).toEqual([
      {
        id: RID,
        // En la hora del salón, no en UTC: el modelo lee literalmente, y con
        // el ISO le decía a la dueña «15:00» por una cita de las 10:00 (F5).
        fecha: 'miércoles, 14 de octubre de 2026',
        hora: '10:00',
        estado: 'pendiente',
        clienta: 'Ana',
        servicios: ['Corte'],
        estilista: 'Monica',
      },
      {
        id: 'r-2',
        fecha: 'jueves, 15 de octubre de 2026',
        hora: '15:00',
        estado: 'confirmada',
        clienta: 'Cliente registrado',
        servicios: ['Corte'],
        estilista: 'Monica',
      },
    ]);
    expect(JSON.stringify(r)).not.toContain('3001112233');
  });

  it('filtra por un día del salón', async () => {
    const r = (await tool.execute({ fecha: '2026-10-15' }, duena)) as {
      citas: { id: string }[];
    };

    expect(r.citas.map((c) => c.id)).toEqual(['r-2']);
  });

  it('rechaza una fecha que no es YYYY-MM-DD', async () => {
    await expect(tool.execute({ fecha: 'mañana' }, duena)).resolves.toEqual({
      ok: false,
      motivo: 'argumentos_invalidos',
    });
  });

  it('a una clienta no le enseña nada', async () => {
    await expect(tool.execute({}, clienta)).resolves.toEqual({
      ok: false,
      motivo: 'solo_administracion',
    });
  });

  it('tampoco a la administración web: es una herramienta del canal WhatsApp', async () => {
    await expect(
      tool.execute(
        {},
        { userId: 'a-1', isAdmin: true, now: ahora, canal: 'web' },
      ),
    ).resolves.toEqual({ ok: false, motivo: 'solo_administracion' });
  });

  it('acota a 15 citas para no disparar los tokens', async () => {
    const muchas = Array.from({ length: 30 }, (_, i) =>
      vista({ id: `r-${i}` }),
    );
    const t = new ViewAgendaTool({ execute: async () => muchas as never });

    const r = (await t.execute({}, duena)) as {
      citas: unknown[];
      hayMas: boolean;
    };

    expect(r.citas).toHaveLength(15);
    expect(r.hayMas).toBe(true);
  });
});

describe('confirmarReserva', () => {
  it('la dueña confirma', async () => {
    const ids: string[] = [];
    const tool = new ConfirmReservationTool({
      execute: async (id: string) => {
        ids.push(id);
        return { status: 'confirmada' };
      },
    });

    await expect(tool.execute({ reservaId: RID }, duena)).resolves.toEqual({
      ok: true,
      estado: 'confirmada',
    });
    expect(ids).toEqual([RID]);
  });

  it('una clienta no puede confirmar, ni aunque invente el id', async () => {
    const tool = new ConfirmReservationTool({
      execute: async () => {
        throw new Error('no debe llegar al caso de uso');
      },
    });

    await expect(tool.execute({ reservaId: RID }, clienta)).resolves.toEqual({
      ok: false,
      motivo: 'solo_administracion',
    });
  });

  it.each([
    [new ReservationNotFoundError(RID), 'reserva_no_encontrada'],
    [
      new InvalidStatusTransitionError('cancelada', 'confirmada'),
      'estado_no_confirmable',
    ],
  ])('traduce %p a un motivo legible', async (error, motivo) => {
    const tool = new ConfirmReservationTool({
      execute: async () => {
        throw error;
      },
    });

    await expect(tool.execute({ reservaId: RID }, duena)).resolves.toEqual({
      ok: false,
      motivo,
    });
  });

  it('sin id, argumentos inválidos', async () => {
    const tool = new ConfirmReservationTool({
      execute: async () => ({ status: 'x' }),
    });

    await expect(tool.execute({}, duena)).resolves.toEqual({
      ok: false,
      motivo: 'argumentos_invalidos',
    });
  });
});

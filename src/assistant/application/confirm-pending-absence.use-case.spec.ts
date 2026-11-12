import { ConfirmPendingAbsenceUseCase } from './confirm-pending-absence.use-case';
import {
  ConsumeAbsenceResult,
  PendingAbsence,
  PendingAbsenceOutcome,
} from '../domain/pending-absence';
import {
  AbsenceOverlapError,
  InvalidAbsenceError,
} from 'src/reservations/domain/errors';
import { MarkAbsenceResult } from 'src/reservations/application/absences/mark-absence.use-case';

/**
 * Ausencias por WhatsApp (2026-11-11): lo que hace el botón «Confirmar» de una
 * propuesta de ausencia. La propuesta se consume una sola vez (el repositorio
 * lo hace atómico) y solo entonces se aplica, con el MISMO caso de uso que el
 * panel.
 */
const DUENA = '573208977471';
const ahora = new Date('2026-11-12T12:05:00Z');
const PROPUESTA: PendingAbsence = {
  id: 'pa-1',
  phoneE164: DUENA,
  workerId: 'w-lu',
  startsAt: new Date('2026-11-12T13:00:00Z'),
  endsAt: new Date('2026-11-12T17:00:00Z'),
  expiresAt: new Date('2026-11-12T12:15:00Z'),
};

const RESULTADO: MarkAbsenceResult = {
  absenceId: 'abs-1',
  workerId: 'w-lu',
  workerName: 'Lucía Ejemplo',
  startsAt: PROPUESTA.startsAt,
  endsAt: PROPUESTA.endsAt,
  impacts: [
    {
      reservationId: 'r-1',
      scheduledAt: new Date('2026-11-12T15:00:00Z'), // 10:00 a. m.
      endedAt: new Date('2026-11-12T15:30:00Z'),
      customerName: 'Clienta Uno',
      customerPhone: '3001112233',
      services: ['Corte'],
      outcome: 'reasignada',
      newWorkerId: 'w-ana',
      newWorkerName: 'Ana Prueba',
    },
    {
      reservationId: 'r-2',
      scheduledAt: new Date('2026-11-12T16:00:00Z'), // 11:00 a. m.
      endedAt: new Date('2026-11-12T16:30:00Z'),
      customerName: 'Clienta Dos',
      customerPhone: null,
      services: ['Tinte'],
      outcome: 'cancelada',
    },
  ],
  sinResolver: [],
};

/** Repositorio que imita el UPDATE atómico: la segunda vez, `usada`. */
function repoDe(propuesta: PendingAbsence | null) {
  let usada = false;
  const consumos: PendingAbsenceOutcome[] = [];
  return {
    consumos,
    repo: {
      consume: async (
        id: string,
        phone: string,
        now: Date,
        outcome: PendingAbsenceOutcome,
      ): Promise<ConsumeAbsenceResult> => {
        if (!propuesta || propuesta.id !== id)
          return { ok: false, motivo: 'no_encontrada' };
        if (propuesta.phoneE164 !== phone)
          return { ok: false, motivo: 'otro_numero' };
        if (usada) return { ok: false, motivo: 'usada' };
        if (propuesta.expiresAt <= now) return { ok: false, motivo: 'vencida' };
        usada = true;
        consumos.push(outcome);
        return { ok: true, absence: propuesta };
      },
    },
  };
}

function montar(
  opts: {
    propuesta?: PendingAbsence | null;
    aplicar?: () => Promise<MarkAbsenceResult>;
    ahora?: Date;
    citas?: Record<string, { scheduledAt: Date; contact: { name: string } }>;
  } = {},
) {
  const aplicadas: unknown[] = [];
  const { repo, consumos } = repoDe(
    opts.propuesta === undefined ? PROPUESTA : opts.propuesta,
  );
  const sut = new ConfirmPendingAbsenceUseCase(
    repo as never,
    {
      executeExact: async (input: unknown) => {
        aplicadas.push(input);
        return (opts.aplicar ?? (async () => RESULTADO))();
      },
    } as never,
    {
      execute: async (id: string) => opts.citas?.[id] ?? null,
    } as never,
    { now: () => opts.ahora ?? ahora },
  );
  return { sut, aplicadas, consumos };
}

describe('ConfirmPendingAbsenceUseCase', () => {
  it('ABS_OK del número de la dueña aplica la ausencia exacta y da una línea por cita', async () => {
    const { sut, aplicadas, consumos } = montar();

    const r = await sut.confirm('pa-1', DUENA);

    expect(aplicadas).toEqual([
      {
        workerId: 'w-lu',
        startsAt: PROPUESTA.startsAt,
        endsAt: PROPUESTA.endsAt,
      },
    ]);
    expect(consumos).toEqual(['confirmada']);
    expect(r).toEqual({
      ok: true,
      resultado: RESULTADO,
      lineas: [
        '10:00 a. m. · Clienta Uno · pasa a Ana Prueba',
        '11:00 a. m. · Clienta Dos · cancelada, avísale',
      ],
    });
  });

  it('sin citas afectadas, ninguna línea', async () => {
    const { sut } = montar({
      aplicar: async () => ({ ...RESULTADO, impacts: [] }),
    });

    expect(await sut.confirm('pa-1', DUENA)).toMatchObject({
      ok: true,
      lineas: [],
    });
  });

  it('una cita sin resolver se escribe «revísala en la bandeja», con su hora y clienta si se pueden leer', async () => {
    const { sut } = montar({
      aplicar: async () => ({
        ...RESULTADO,
        impacts: [],
        sinResolver: ['r-9', 'r-perdida'],
      }),
      citas: {
        'r-9': {
          scheduledAt: new Date('2026-11-12T14:30:00Z'), // 9:30 a. m.
          contact: { name: 'Clienta Nueve' },
        },
      },
    });

    expect(await sut.confirm('pa-1', DUENA)).toMatchObject({
      ok: true,
      lineas: [
        '9:30 a. m. · Clienta Nueve · revísala en la bandeja',
        'Una cita que no pude leer · revísala en la bandeja',
      ],
    });
  });

  it.each([
    ['vencida', { ahora: new Date('2026-11-12T12:20:00Z') }, DUENA],
    ['otro_numero', {}, '573001112233'],
  ] as const)(
    'ABS_OK %s → no aplica y da el motivo',
    async (motivo, opts, numero) => {
      const { sut, aplicadas } = montar(opts);

      expect(await sut.confirm('pa-1', numero)).toEqual({ ok: false, motivo });
      expect(aplicadas).toEqual([]);
    },
  );

  it('ABS_OK usado (doble toque) → la segunda no aplica: usada', async () => {
    const { sut, aplicadas } = montar();

    await sut.confirm('pa-1', DUENA);
    const segunda = await sut.confirm('pa-1', DUENA);

    expect(segunda).toEqual({ ok: false, motivo: 'usada' });
    expect(aplicadas).toHaveLength(1);
  });

  it('ABS_OK de una propuesta que no existe → no_encontrada', async () => {
    const { sut, aplicadas } = montar({ propuesta: null });

    expect(await sut.confirm('pa-1', DUENA)).toEqual({
      ok: false,
      motivo: 'no_encontrada',
    });
    expect(aplicadas).toEqual([]);
  });

  it.each([
    [new AbsenceOverlapError(), 'ausencia_cruzada'],
    [new InvalidAbsenceError('esa franja ya pasó'), 'ausencia_invalida'],
    [new Error('base caída'), 'error_desconocido'],
  ])(
    'si aplicar lanza %p → %s (la propuesta queda gastada)',
    async (error, motivo) => {
      const { sut, consumos } = montar({
        aplicar: async () => {
          throw error;
        },
      });

      expect(await sut.confirm('pa-1', DUENA)).toEqual({ ok: false, motivo });
      expect(consumos).toEqual(['confirmada']);
    },
  );

  it('ABS_NO descarta sin aplicar', async () => {
    const { sut, aplicadas, consumos } = montar();

    expect(await sut.discard('pa-1', DUENA)).toEqual({ ok: true });
    expect(consumos).toEqual(['descartada']);
    expect(aplicadas).toEqual([]);
    // Ya descartada, «Confirmar» del mismo mensaje no hace nada.
    expect(await sut.confirm('pa-1', DUENA)).toEqual({
      ok: false,
      motivo: 'usada',
    });
  });

  it('ABS_NO de otro número no descarta', async () => {
    const { sut, consumos } = montar();

    expect(await sut.discard('pa-1', '573001112233')).toEqual({
      ok: false,
      motivo: 'otro_numero',
    });
    expect(consumos).toEqual([]);
  });
});

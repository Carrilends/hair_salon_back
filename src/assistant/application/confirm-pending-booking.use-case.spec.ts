import { ConfirmPendingBookingUseCase } from './confirm-pending-booking.use-case';
import {
  ConsumeResult,
  PendingBooking,
  PendingBookingOutcome,
} from '../domain/pending-booking';
import { WorkerOverlapError } from 'src/reservations/domain/errors';

/**
 * Plan 06, F4 (D4): lo que pasa al pulsar «Confirmar». La propuesta se consume
 * una sola vez —el repositorio lo hace atómico— y solo entonces se crea la
 * reserva, con el caso de uso de siempre.
 */
const NUMERO = '573001112233';
const ahora = new Date('2026-10-14T15:05:00Z');
const PROPUESTA: PendingBooking = {
  id: 'p-1',
  phoneE164: NUMERO,
  customerName: 'Ana',
  serviceIds: ['s-1'],
  scheduledAt: new Date('2026-10-20T15:00:00Z'),
  expiresAt: new Date('2026-10-14T15:15:00Z'),
};

/** Repositorio que imita el UPDATE atómico: la segunda vez, `usada`. */
function repoDe(propuesta: PendingBooking | null) {
  let usada = false;
  const consumos: PendingBookingOutcome[] = [];
  return {
    consumos,
    repo: {
      consume: async (
        id: string,
        phone: string,
        now: Date,
        outcome: PendingBookingOutcome,
      ): Promise<ConsumeResult> => {
        if (!propuesta || propuesta.id !== id)
          return { ok: false, motivo: 'no_encontrada' };
        if (propuesta.phoneE164 !== phone)
          return { ok: false, motivo: 'otro_numero' };
        if (usada) return { ok: false, motivo: 'usada' };
        if (propuesta.expiresAt <= now) return { ok: false, motivo: 'vencida' };
        usada = true;
        consumos.push(outcome);
        return { ok: true, booking: propuesta };
      },
    },
  };
}

function montar(
  propuesta: PendingBooking | null = PROPUESTA,
  crear: () => Promise<{ id?: string; status: string }> = async () => ({
    id: 'r-1',
    status: 'pendiente',
  }),
) {
  const comandos: unknown[] = [];
  const { repo, consumos } = repoDe(propuesta);
  const sut = new ConfirmPendingBookingUseCase(
    repo as never,
    {
      execute: async (c: unknown) => {
        comandos.push(c);
        return crear();
      },
    } as never,
    { now: () => ahora },
  );
  return { sut, comandos, consumos };
}

describe('ConfirmPendingBookingUseCase', () => {
  it('crea la reserva a nombre del número, sin usuario, con lo propuesto', async () => {
    const { sut, comandos } = montar();

    await expect(sut.confirm('p-1', NUMERO)).resolves.toEqual({
      ok: true,
      reservaId: 'r-1',
      scheduledAt: PROPUESTA.scheduledAt,
    });
    expect(comandos).toEqual([
      {
        scheduledAt: '2026-10-20T15:00:00.000Z',
        serviceIds: ['s-1'],
        userId: null,
        contact: { name: 'Ana', phone: NUMERO },
      },
    ]);
  });

  it('confirmar dos veces crea UNA sola reserva', async () => {
    const { sut, comandos } = montar();

    const [a, b] = await Promise.all([
      sut.confirm('p-1', NUMERO),
      sut.confirm('p-1', NUMERO),
    ]);

    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect(comandos).toHaveLength(1);
  });

  it('una propuesta de otro número no se confirma', async () => {
    const { sut, comandos } = montar();

    await expect(sut.confirm('p-1', '573009998888')).resolves.toEqual({
      ok: false,
      motivo: 'otro_numero',
    });
    expect(comandos).toHaveLength(0);
  });

  it('vencida, no se confirma', async () => {
    const { sut, comandos } = montar({
      ...PROPUESTA,
      expiresAt: new Date('2026-10-14T15:00:00Z'),
    });

    await expect(sut.confirm('p-1', NUMERO)).resolves.toEqual({
      ok: false,
      motivo: 'vencida',
    });
    expect(comandos).toHaveLength(0);
  });

  it('si la hora se ocupó entre proponer y confirmar, lo dice', async () => {
    const { sut } = montar(PROPUESTA, async () => {
      throw new WorkerOverlapError();
    });

    await expect(sut.confirm('p-1', NUMERO)).resolves.toEqual({
      ok: false,
      motivo: 'hora_ocupada',
    });
  });

  it('descartar la consume sin crear nada', async () => {
    const { sut, comandos, consumos } = montar();

    await expect(sut.discard('p-1', NUMERO)).resolves.toEqual({ ok: true });
    expect(consumos).toEqual(['descartada']);
    expect(comandos).toHaveLength(0);
    // Y ya no se puede confirmar después.
    await expect(sut.confirm('p-1', NUMERO)).resolves.toEqual({
      ok: false,
      motivo: 'usada',
    });
  });
});

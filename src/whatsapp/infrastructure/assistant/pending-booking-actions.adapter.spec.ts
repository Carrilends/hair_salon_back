import { PendingBookingActionsAdapter } from './pending-booking-actions.adapter';
import { ConfirmPendingBookingUseCase } from 'src/assistant/application/confirm-pending-booking.use-case';
import { CreateReservationUseCase } from 'src/reservations/application/create-reservation.use-case';
import { WorkerAssigner } from 'src/reservations/application/worker-assigner';
import { HandleInboundMessageUseCase } from 'src/whatsapp/application/handle-inbound-message.use-case';
import { encodeButtonPayload } from 'src/whatsapp/domain/button-payload';
import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';
import { PendingBooking } from 'src/assistant/domain/pending-booking';

/**
 * Caso de aceptación tras `afd06bb`: «Confirmar» fuera de horario respondía
 * «Esa hora queda fuera del horario del salón.» SIN el horario del día, porque
 * este adaptador tiraba `scheduledAt` del resultado fallido y el canal ya no
 * sabía de qué día hablar.
 */
const PID = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const CLIENTA = '573001112233';
const SABADO_8 = new Date('2026-10-17T13:00:00Z'); // sábado 8:00 en Bogotá

describe('PendingBookingActionsAdapter.confirm', () => {
  const adaptador = (resultado: unknown) =>
    new PendingBookingActionsAdapter({
      confirm: async () => resultado,
    } as unknown as ConfirmPendingBookingUseCase);

  it('si la creación falla, conserva la hora de la propuesta junto al motivo', async () => {
    await expect(
      adaptador({
        ok: false,
        motivo: 'fuera_de_horario',
        scheduledAt: SABADO_8,
      }).confirm(PID, CLIENTA),
    ).resolves.toEqual({
      ok: false,
      motivo: 'fuera_de_horario',
      scheduledAt: SABADO_8,
    });
  });

  it('si la propuesta no se pudo consumir, no inventa una hora', async () => {
    await expect(
      adaptador({ ok: false, motivo: 'otro_numero' }).confirm(PID, CLIENTA),
    ).resolves.toEqual({ ok: false, motivo: 'otro_numero' });
  });

  it('si sale bien, devuelve la hora como antes', async () => {
    await expect(
      adaptador({ ok: true, reservaId: 'r-1', scheduledAt: SABADO_8 }).confirm(
        PID,
        CLIENTA,
      ),
    ).resolves.toEqual({ ok: true, scheduledAt: SABADO_8 });
  });
});

/**
 * De punta a punta sin base ni Meta: el caso de uso de confirmar y el de crear
 * reales, este adaptador real y el manejador real del canal. Lo que se mira es
 * el texto que recibe la clienta.
 */
describe('«Confirmar» fuera de horario, por el adaptador real: la clienta lee el horario de ese día', () => {
  it('propuesta antigua del sábado a las 8:00', async () => {
    const propuesta: PendingBooking = {
      id: PID,
      phoneE164: CLIENTA,
      customerName: 'Ana',
      serviceIds: ['s-1'],
      scheduledAt: SABADO_8,
      expiresAt: new Date('2026-10-14T15:15:00Z'),
    };
    const ahora = { now: () => new Date('2026-10-14T15:05:00Z') };
    const repositorio = {
      countOverlaps: async () => 0,
      save: async () => {
        throw new Error('no debería guardarse');
      },
    };
    const crear = new CreateReservationUseCase(
      repositorio as never,
      new WorkerAssigner(
        repositorio as never,
        {
          getDefaultWorkerId: async () => 'default-w',
          listAssignableWorkloads: async () => [],
        } as never,
      ),
      {
        getSnapshots: async (ids: string[]) =>
          ids.map((id) => ({
            id,
            name: 'Corte',
            price: 1,
            durationMinutes: 30,
          })),
      } as never,
      ahora,
      { reservationCreated: async () => undefined } as never,
    );
    const confirmar = new ConfirmPendingBookingUseCase(
      {
        consume: async () => ({ ok: true, booking: propuesta }),
      } as never,
      crear,
      ahora,
    );
    const enviados: WhatsAppMessage[] = [];
    const canal = new HandleInboundMessageUseCase(
      {} as never,
      { send: async (m: WhatsAppMessage) => void enviados.push(m) } as never,
      { ownerPhone: '573208977471', timeZone: 'America/Bogota' },
      ahora as never,
      new PendingBookingActionsAdapter(confirmar),
    );

    await canal.handle({
      messageId: 'wamid.X',
      from: CLIENTA,
      kind: 'button',
      payload: encodeButtonPayload({ action: 'book_ok', bookingId: PID }),
      text: null,
    });

    expect(enviados).toHaveLength(1);
    const texto = enviados[0].kind === 'text' ? enviados[0].body : '';
    expect(texto).toMatch(/^Esa hora queda fuera del horario del salón: /);
    expect(texto).toContain('sábado 17 de octubre');
    expect(texto).toContain('abre de 9:00 a. m. a 7:00 p. m.');
  });
});

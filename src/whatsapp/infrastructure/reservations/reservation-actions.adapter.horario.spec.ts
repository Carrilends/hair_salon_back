import { ReservationActionsAdapter } from './reservation-actions.adapter';
import { RescheduleReservationUseCase } from 'src/reservations/application/reschedule-reservation.use-case';
import { WorkerAssigner } from 'src/reservations/application/worker-assigner';
import { Reservation } from 'src/reservations/domain/reservation';
import { ReservationStatus } from 'src/reservations/domain/reservation-status';
import { HandleInboundMessageUseCase } from 'src/whatsapp/application/handle-inbound-message.use-case';
import { WhatsAppMessage } from 'src/notifications/domain/ports/whatsapp-sender.port';

/** Sin ausencias: el comportamiento previo a la regla. */
const SIN_AUSENCIAS = { overlapsAny: async () => false };

/**
 * Comprobación pedida tras el caso de aceptación de `afd06bb` («Confirmar»
 * perdía el horario del día en su adaptador): ¿le pasa lo mismo al botón de
 * mover (`RSAT`)? Por el adaptador real y el caso de uso real de reprogramar,
 * el texto que recibe la clienta debe traer el horario de ese día.
 *
 * No le pasa: `ReservationActionsAdapter.reschedule` deja subir el error de
 * dominio tal cual, y la hora la sabe el propio botón. Esta prueba lo fija.
 */
const RID = '4d2f0e4e-6f1b-4a3e-9a2f-2b1c3d4e5f60';
const CLIENTA = '573001112233';

describe('RSAT fuera de horario, por el adaptador real: la clienta lee el horario de ese día', () => {
  it('mover al sábado a las 8:00', async () => {
    const ahora = { now: () => new Date('2026-10-14T15:05:00Z') };
    const cita = Reservation.fromPersistence({
      id: RID,
      userId: null,
      contact: { name: 'Ana', phone: CLIENTA, email: null },
      scheduledAt: new Date('2026-10-20T15:00:00Z'),
      endedAt: new Date('2026-10-20T15:30:00Z'),
      workerId: 'w-1',
      status: ReservationStatus.Pendiente,
      lines: [
        { serviceId: 's-1', name: 'Corte', price: 1, durationMinutes: 30 },
      ],
    });
    const guardadas: unknown[] = [];
    const repositorio = {
      findById: async () => cita,
      countOverlaps: async () => 0,
      save: async (r: unknown) => void guardadas.push(r),
    };
    const mover = new RescheduleReservationUseCase(
      repositorio as never,
      ahora,
      { reservationRescheduled: async () => undefined } as never,
      new WorkerAssigner(
        repositorio as never,
        {
          getDefaultWorkerId: async () => 'default-w',
          listAssignableWorkloads: async () => [],
        } as never,
        SIN_AUSENCIAS as never,
      ),
      SIN_AUSENCIAS as never,
    );
    const adaptador = new ReservationActionsAdapter(
      {} as never,
      {} as never,
      {} as never,
      mover,
      {} as never,
      {} as never,
    );
    const enviados: WhatsAppMessage[] = [];
    const canal = new HandleInboundMessageUseCase(
      adaptador,
      { send: async (m: WhatsAppMessage) => void enviados.push(m) } as never,
      { ownerPhone: '573208977471', timeZone: 'America/Bogota' },
      ahora as never,
    );

    await canal.handle({
      messageId: 'wamid.X',
      from: CLIENTA,
      kind: 'button',
      payload: `RSAT|${RID}|2026-10-17T08:00`,
      text: null,
    });

    expect(guardadas).toHaveLength(0);
    expect(enviados).toHaveLength(1);
    const texto = enviados[0].kind === 'text' ? enviados[0].body : '';
    expect(texto).toMatch(/^Esa hora queda fuera del horario del salón: /);
    expect(texto).toContain('sábado 17 de octubre');
    expect(texto).toContain('abre de 9:00 a. m. a 7:00 p. m.');
  });
});

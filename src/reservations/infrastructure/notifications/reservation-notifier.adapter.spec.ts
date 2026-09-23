import { ReservationNotifierAdapter } from './reservation-notifier.adapter';
import { Reservation } from '../../domain/reservation';
import { ReservationStatus } from '../../domain/reservation-status';
import { NotifiableEvent } from 'src/notifications/domain/events/notifiable-event';

function reservationWith(
  props: Partial<Parameters<typeof Reservation.fromPersistence>[0]> = {},
) {
  return Reservation.fromPersistence({
    id: 'r-1',
    userId: null,
    contact: { name: 'Ana', phone: '3001234567', email: null },
    scheduledAt: new Date('2026-08-20T15:00:00.000Z'),
    endedAt: new Date('2026-08-20T16:00:00.000Z'),
    workerId: 'w-1',
    status: ReservationStatus.Pendiente,
    lines: [
      { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
      { serviceId: 's2', name: 'Peinado', price: 15000, durationMinutes: 30 },
    ],
    ...props,
  });
}

describe('ReservationNotifierAdapter', () => {
  it('traduce la reserva a un evento y lo despacha con el nombre del estilista', async () => {
    const despachados: NotifiableEvent[] = [];
    const dispatcher = {
      notify: async (e: NotifiableEvent) => {
        despachados.push(e);
      },
    };
    const workers = { getWorkerName: async () => 'Marlene' };
    const adapter = new ReservationNotifierAdapter(
      dispatcher as any,
      workers as any,
    );

    await adapter.reservationCreated(reservationWith());

    expect(despachados).toHaveLength(1);
    expect(despachados[0]).toMatchObject({
      type: 'reservation.created',
      reservationId: 'r-1',
      workerName: 'Marlene',
      customerName: 'Ana',
      customerPhone: '3001234567',
      totalDurationMinutes: 60,
      totalPrice: 35000,
      status: 'pendiente',
    });
    expect(despachados[0].services).toEqual([
      { name: 'Corte', price: 20000, durationMinutes: 30 },
      { name: 'Peinado', price: 15000, durationMinutes: 30 },
    ]);
  });

  it('usa un nombre genérico y teléfono nulo si la reserva es de un usuario sin contacto', async () => {
    const despachados: NotifiableEvent[] = [];
    const dispatcher = {
      notify: async (e: NotifiableEvent) => {
        despachados.push(e);
      },
    };
    const workers = { getWorkerName: async () => 'Marlene' };
    const adapter = new ReservationNotifierAdapter(
      dispatcher as any,
      workers as any,
    );

    await adapter.reservationCreated(
      reservationWith({ userId: 'u-1', contact: null }),
    );

    expect(despachados[0].customerName).toBe('Cliente registrado');
    expect(despachados[0].customerPhone).toBeNull();
  });
});

/**
 * El traductor no decide, propaga. Quién recibe el aviso de una reprogramación
 * lo deciden los canales (`ClientWhatsAppNotifier` mira `byAdmin` y ahora
 * también `workerChanged`); aquí solo hay que garantizar que el dato llega. Si
 * se perdiera en la traducción, el aviso del cambio de estilista no existiría y
 * el fallo sería silencioso hasta el día de la cita.
 */
describe('ReservationNotifierAdapter · reprogramación', () => {
  function montar() {
    const despachados: NotifiableEvent[] = [];
    const dispatcher = {
      notify: async (e: NotifiableEvent) => {
        despachados.push(e);
      },
    };
    const workers = { getWorkerName: async () => 'Monica' };
    return {
      adapter: new ReservationNotifierAdapter(
        dispatcher as any,
        workers as any,
      ),
      despachados,
    };
  }

  it('lleva al evento si cambió la estilista, junto al antes y al byAdmin', async () => {
    const { adapter, despachados } = montar();

    await adapter.reservationRescheduled(reservationWith(), {
      byAdmin: false,
      previousScheduledAt: new Date('2026-08-19T15:00:00.000Z'),
      workerChanged: true,
    });

    expect(despachados[0]).toMatchObject({
      type: 'reservation.rescheduled',
      byAdmin: false,
      previousScheduledAt: new Date('2026-08-19T15:00:00.000Z'),
      workerChanged: true,
      // El nombre efectivo ya viajaba: es el único que usan las plantillas.
      workerName: 'Monica',
    });
  });

  it('no lo inventa: si no cambió, el evento dice que no cambió', async () => {
    const { adapter, despachados } = montar();

    await adapter.reservationRescheduled(reservationWith(), {
      byAdmin: true,
      previousScheduledAt: new Date('2026-08-19T15:00:00.000Z'),
      workerChanged: false,
    });

    expect(despachados[0]).toMatchObject({ workerChanged: false });
  });
});

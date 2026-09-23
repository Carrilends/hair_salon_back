import { ReservationMapper } from './reservation.mapper';
import { Reservation } from '../../domain/reservation';
import { ReservationStatus } from '../../domain/reservation-status';

const line = {
  serviceId: 's-1',
  name: 'Corte',
  price: 30000,
  durationMinutes: 60,
};

function conTelefono(phone: string | null): Reservation {
  return Reservation.fromPersistence({
    id: 'r-1',
    userId: null,
    contact: phone === null ? null : { name: 'Ana', phone },
    scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
    endedAt: new Date('2026-08-20T15:00:00.000Z'),
    workerId: 'w-1',
    status: ReservationStatus.Pendiente,
    lines: [{ ...line }],
  });
}

/**
 * El teléfono se guarda **dos veces**: crudo tal como lo escribió la clienta (es
 * lo que ella reconoce si se le muestra) y normalizado a E.164 en una columna
 * aparte, que es la única consultable. La columna derivada la calcula el mapper
 * en `toOrmScalars`, que corre tanto al crear como al actualizar, así que se
 * mantiene sola sin disparadores ni columnas generadas en SQL.
 */
describe('ReservationMapper · columna derivada del teléfono', () => {
  it('normaliza el teléfono a E.164 en las columnas escalares', () => {
    const escalares = ReservationMapper.toOrmScalars(
      conTelefono('+57 300 123 4567'),
    );

    expect(escalares.customerPhone).toBe('+57 300 123 4567'); // crudo intacto
    expect(escalares.customerPhoneE164).toBe('573001234567');
  });

  it('deja la columna derivada en null si no es un móvil colombiano', () => {
    // Un fijo o un número mal escrito no es contactable por WhatsApp: la columna
    // queda nula y esa reserva simplemente no aparece en las búsquedas del canal.
    const escalares = ReservationMapper.toOrmScalars(conTelefono('6011234567'));

    expect(escalares.customerPhone).toBe('6011234567');
    expect(escalares.customerPhoneE164).toBeNull();
  });

  it('deja la columna derivada en null si la reserva no tiene contacto', () => {
    const escalares = ReservationMapper.toOrmScalars(conTelefono(null));

    expect(escalares.customerPhone).toBeNull();
    expect(escalares.customerPhoneE164).toBeNull();
  });
});

/**
 * Origen de la asignación de estilista.
 *
 * `worker_id` dice **quién** atiende, pero no **por qué**: si la eligió la
 * clienta o la repartió el sistema. Esa diferencia decide si la reprogramación
 * puede reasignar, así que tiene que sobrevivir al viaje de ida y vuelta a la
 * base; si se pierde en el mapper, el fallo es silencioso y solo se descubre el
 * día de la cita.
 */
describe('ReservationMapper · origen de la asignación de estilista', () => {
  it('persiste la marca de estilista elegida en las columnas escalares', () => {
    const elegida = Reservation.fromPersistence({
      id: 'r-1',
      userId: 'u-1',
      contact: null,
      scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
      endedAt: new Date('2026-08-20T15:00:00.000Z'),
      workerId: 'w-1',
      workerPinned: true,
      status: ReservationStatus.Pendiente,
      lines: [{ ...line }],
    });

    expect(ReservationMapper.toOrmScalars(elegida).workerPinned).toBe(true);
  });

  it('deja la marca en false cuando la estilista la repartió el sistema', () => {
    expect(ReservationMapper.toOrmScalars(conTelefono(null)).workerPinned).toBe(
      false,
    );
  });

  it('toDomain devuelve la marca que traía la fila', () => {
    const fila = {
      id: 'r-1',
      userId: null,
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      scheduledAt: new Date('2026-08-20T14:00:00.000Z'),
      endedAt: new Date('2026-08-20T15:00:00.000Z'),
      workerId: 'w-1',
      workerPinned: true,
      status: 'pendiente',
      services: [],
    } as unknown as Parameters<typeof ReservationMapper.toDomain>[0];

    expect(ReservationMapper.toDomain(fila).workerPinned).toBe(true);
  });
});

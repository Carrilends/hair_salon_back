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

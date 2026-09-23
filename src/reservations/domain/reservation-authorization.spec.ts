import { Reservation } from './reservation';
import { ReservationStatus } from './reservation-status';
import { ReservationOwnershipError } from './errors';
import { assertCanActOn } from './reservation-authorization';

const lines = [
  { serviceId: 's1', name: 'Corte', price: 20000, durationMinutes: 30 },
];

function deUsuario(userId: string): Reservation {
  return Reservation.schedule({
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    workerId: 'w-1',
    workerPinned: false,
    userId,
    lines,
  });
}

function anonima(phone: string): Reservation {
  return Reservation.schedule({
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    workerId: 'w-1',
    workerPinned: false,
    contact: { name: 'Ana', phone },
    lines,
  });
}

function sinContacto(): Reservation {
  // Reserva de usuaria con sesión: no lleva teléfono, así que ningún número
  // puede reclamarla.
  return Reservation.fromPersistence({
    id: 'r-1',
    userId: 'u-1',
    contact: null,
    scheduledAt: new Date('2026-04-20T15:00:00.000Z'),
    endedAt: new Date('2026-04-20T15:30:00.000Z'),
    workerId: 'w-1',
    status: ReservationStatus.Pendiente,
    lines,
  });
}

describe('assertCanActOn · actor administrador', () => {
  it('la administración puede actuar sobre cualquier reserva', () => {
    expect(() =>
      assertCanActOn(anonima('3001234567'), { kind: 'admin' }),
    ).not.toThrow();
    expect(() =>
      assertCanActOn(deUsuario('u-1'), { kind: 'admin' }),
    ).not.toThrow();
  });
});

describe('assertCanActOn · actor con sesión', () => {
  it('la dueña de la reserva puede actuar sobre ella', () => {
    expect(() =>
      assertCanActOn(deUsuario('u-1'), { kind: 'user', userId: 'u-1' }),
    ).not.toThrow();
  });

  it('otra usuaria no puede', () => {
    expect(() =>
      assertCanActOn(deUsuario('u-1'), { kind: 'user', userId: 'otra' }),
    ).toThrow(ReservationOwnershipError);
  });

  it('NINGUNA usuaria con sesión puede actuar sobre una reserva anónima', () => {
    // Este es el agujero que cierra la unión. Antes se comparaba
    // `reservation.userId !== actor.userId`: con la reserva anónima
    // (`userId === null`) y un actor sin sesión (`userId === null`), la
    // comparación era falsa y la autorización PASABA. Una reserva sin dueño no
    // pertenece a nadie con sesión.
    expect(() =>
      assertCanActOn(anonima('3001234567'), { kind: 'user', userId: 'u-1' }),
    ).toThrow(ReservationOwnershipError);
  });
});

describe('assertCanActOn · actor por teléfono (canal de WhatsApp)', () => {
  it('el número que reservó puede actuar sobre su reserva', () => {
    expect(() =>
      assertCanActOn(anonima('3001234567'), {
        kind: 'phone',
        phoneE164: '573001234567',
      }),
    ).not.toThrow();
  });

  it('compara sobre el valor normalizado, no sobre el crudo', () => {
    // El teléfono se guarda tal como lo escribió la clienta. `+57 300 123 4567`
    // y `573001234567` son la misma persona: si se comparara en crudo, nadie
    // podría usar el canal.
    expect(() =>
      assertCanActOn(anonima('+57 300 123 4567'), {
        kind: 'phone',
        phoneE164: '573001234567',
      }),
    ).not.toThrow();
  });

  it('otro número NO puede actuar sobre una reserva ajena', () => {
    expect(() =>
      assertCanActOn(anonima('3001234567'), {
        kind: 'phone',
        phoneE164: '573009999999',
      }),
    ).toThrow(ReservationOwnershipError);
  });

  it('una reserva sin contacto no es reclamable por ningún número', () => {
    expect(() =>
      assertCanActOn(sinContacto(), {
        kind: 'phone',
        phoneE164: '573001234567',
      }),
    ).toThrow(ReservationOwnershipError);
  });

  it('un teléfono guardado que no es un móvil válido no es reclamable', () => {
    // Un fijo normaliza a `null`; si no se comprobara, `null === null` dejaría
    // pasar a cualquiera que también normalizase a nulo.
    expect(() =>
      assertCanActOn(anonima('6011234567'), {
        kind: 'phone',
        phoneE164: '573001234567',
      }),
    ).toThrow(ReservationOwnershipError);
  });
});
